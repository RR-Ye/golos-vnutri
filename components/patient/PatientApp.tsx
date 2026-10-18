"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEvidence,
  answerGrid,
  answerQuestion,
  contextEntities,
  entityActionTiles,
  evaluate,
  homeTiles,
  messageText,
  needsSlotChoice,
  newSession,
  paginate,
  parseCandidateKey,
  posterior,
  preferEntityActions,
  rejectConfirm,
  slotChoiceTiles,
  tileKey,
  topicTiles,
  type Candidate,
  type Evidence,
  type FlowTile,
  type MessageSentence,
  type Question,
  type Scored,
  type SessionState,
} from "@/engine";
import { BUILTIN_ENTITIES, frameById, topicById } from "@/engine/ontology";
import type { ConnectiveId, Entity, FaceLevel, Lang, TopicId } from "@/engine/types";
import { CONNECTIVES } from "@/engine/types";
import { playAlarm } from "@/lib/audio/alarm";
import { Listener, loadTemplates, recognizeRecording, type HeardSeries } from "@/lib/audio/asr";
import type { Template } from "@/engine/asr";
import { db, newId } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { utterancesFor, type SoundItem } from "@/lib/audio/sound";
import { speaker } from "@/lib/audio/speaker";
import { ensurePiper } from "@/lib/audio/piper";
import { useStressLexicon } from "@/lib/audio/useStressLexicon";
import type { AnswerButton, AnswerMeaning, Settings } from "@/lib/db/types";
import { nlgOptions, useEngineData, useEngineModel } from "@/lib/engine/useEngine";
import { saveMessage, saveRejection } from "@/lib/engine/history";
import { patientDict } from "@/lib/i18n";
import { useWakeLock } from "@/lib/useWakeLock";
import { EntityPicture } from "../EntityPicture";
import { Icon } from "../Icon";
import { PinForm } from "../PinForm";
import { BodyFigure, BodyMini, type BodySide, zonesOf } from "./BodyFigure";
import { CornerHold } from "./CornerHold";
import { CandidatePicture, ConnectiveGlyph, EntityOrBody, FaceSvg, SpeakerLang } from "./pictures";
import { Press } from "./Press";
import { Shell } from "./Shell";
import {
  candidateItem,
  candidateText,
  entityItem,
  frameLabels,
  frameTileItem,
  promptItem,
  questionText,
  textItem,
  topicItem,
} from "./speech";
import { href } from "@/lib/base";
import { Tile, TileGrid } from "./Tile";
import { usePatientLayout } from "./useLayout";

type Screen =
  | { kind: "start" }
  | { kind: "home"; page: number }
  | { kind: "topic"; topic: TopicId; page: number }
  | { kind: "actions"; entity: string; page: number }
  | { kind: "choices"; frame: string; page: number }
  | { kind: "body"; side: BodySide; page: number }
  | { kind: "faceParts" }
  | { kind: "severity"; zone: string }
  | { kind: "faces"; back: Screen }
  | { kind: "question"; question: Question }
  | { kind: "confirm"; candidate: Candidate }
  | { kind: "grid"; options: Scored[] }
  | { kind: "final" }
  | { kind: "connective" }
  | { kind: "help"; back: Screen }
  | { kind: "didYouSay"; series: HeardSeries; back: Screen };

const FACE_PARTS = [
  { entity: "body.eyes", icon: "eye" },
  { entity: "body.ears", icon: "ear" },
  { entity: "body.teeth", icon: "tooth" },
  { entity: "body.throat", icon: "scarf" },
];

const SEVERITY_BY_FACE: Record<FaceLevel, string> = { 1: "sev.1", 2: "sev.1", 3: "sev.1", 4: "sev.2", 5: "sev.3" };
const LEVELS: FaceLevel[] = [1, 2, 3, 4, 5];
const stripEnd = (s: string) => s.replace(/[.!]$/, "");

export function PatientApp({ settings }: { settings: Settings }) {
  const layout = usePatientLayout();
  const data = useEngineData();
  const [message, setMessage] = useState<MessageSentence[]>([]);
  const [sentEvidence, setSentEvidence] = useState<Evidence[][]>([]);
  const [messageSteps, setMessageSteps] = useState(0);
  const [repeatSeries, setRepeatSeries] = useState(0);
  const context = useMemo(() => contextEntities(message), [message]);
  const model = useEngineModel(settings, data, context);
  const opts = useMemo(() => nlgOptions(settings, data?.overrides), [settings, data?.overrides]);
  const phraseAudio = useMemo(
    () => new Map((data?.overrides ?? []).filter((o) => o.audio).map((o) => [o.key, o.audio!] as const)),
    [data?.overrides],
  );
  const [screen, setScreen] = useState<Screen>({ kind: "start" });
  const [browse, setBrowse] = useState<Screen>({ kind: "home", page: 0 });
  const [session, setSession] = useState<SessionState>(newSession);
  const [pendingConnective, setPendingConnective] = useState<ConnectiveId | undefined>();
  const [anythingElseShown, setAnythingElseShown] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const listener = useRef<Listener | null>(null);
  const templates = useRef<Template[]>([]);
  const sampleCount = useLiveQuery(() => db().samples.count(), []);
  useEffect(() => {
    if (sampleCount === undefined) return;
    void loadTemplates().then((t) => (templates.current = t));
  }, [sampleCount]);
  const lang: Lang = settings.primaryLang;
  const otherLang: Lang = lang === "ru" ? "kk" : "ru";
  const d = patientDict(lang);
  const dOther = patientDict(otherLang);

  useWakeLock(screen.kind !== "start");
  // iPad Safari не всегда слушается touch-action: глушим жест масштабирования вручную.
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", stop);
    document.addEventListener("dblclick", stop);
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("dblclick", stop);
    };
  }, []);
  useEffect(() => {
    speaker.systemVoice = settings.systemVoice !== false;
  }, [settings.systemVoice]);
  useEffect(() => {
    void ensurePiper((b) => (speaker.synth = b));
  }, []);
  useStressLexicon();
  useEffect(() => {
    document.documentElement.dataset.theme = settings.patientTheme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [settings.patientTheme]);

  const entities = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const e of BUILTIN_ENTITIES) m.set(e.id, e);
    for (const e of data?.entities ?? []) m.set(e.id, e);
    return m;
  }, [data?.entities]);

  const post = useMemo(() => (model ? posterior(model, session.evidence) : null), [model, session.evidence]);
  const homePrior = useMemo(() => (model ? posterior(model, []) : null), [model]);

  const say = useCallback(
    (item: SoundItem, interrupt = false) => {
      void speaker.speak(utterancesFor(item, settings), { interrupt });
    },
    [settings],
  );

  const bothTexts = useCallback(
    (msg: MessageSentence[]) => ({ ru: messageText(msg, entities, "ru", opts), kk: messageText(msg, entities, "kk", opts) }),
    [entities, opts],
  );

  // ---------- переходы ----------

  const resetAll = useCallback(() => {
    speaker.stop();
    setMessage([]);
    setSentEvidence([]);
    setMessageSteps(0);
    setRepeatSeries(0);
    setPendingConnective(undefined);
    setSession(newSession());
    setBrowse({ kind: "home", page: 0 });
    setScreen({ kind: "home", page: 0 });
    setAnythingElseShown(false);
  }, []);

  const finishMessage = useCallback(
    async (msg: MessageSentence[], ev: Evidence[][]) => {
      if (model && msg.length) {
        await saveMessage({ message: msg, evidence: ev, model, entities, words: data?.words ?? [], opts, steps: messageSteps, repeatSeries });
      }
      resetAll();
    },
    [model, entities, opts, messageSteps, repeatSeries, resetAll, data?.words],
  );

  const finalize = useCallback(
    (candidate: Candidate, s: SessionState) => {
      const nextMsg = [...message, { candidate, connective: pendingConnective }];
      setMessage(nextMsg);
      setSentEvidence((prev) => [...prev, [...s.evidence]]);
      setMessageSteps((n) => n + s.steps + 1);
      setRepeatSeries((n) => n + s.repeatSeries);
      setPendingConnective(undefined);
      setSession(newSession());
      setBrowse({ kind: "home", page: 0 });
      if (frameById(candidate.frame)?.leadsOn) {
        setScreen({ kind: "home", page: 0 });
        say(promptItem("whatToSay"), true);
        return;
      }
      setAnythingElseShown(false);
      setScreen({ kind: "final" });
      say(nextMsg.length === 1 ? candidateItem(candidate, entities, opts, "phrases", phraseAudio) : textItem(bothTexts(nextMsg), "phrases"), true);
      say(promptItem("repeatPlease"));
    },
    [message, pendingConnective, say, bothTexts, entities, opts, phraseAudio],
  );

  /** После каждого действия: пересчёт гипотез и выбор следующего экрана. */
  const advance = useCallback(
    (s: SessionState, back: Screen) => {
      setSession(s);
      setBrowse(back);
      if (!model) return setScreen(back);
      const policy = { threshold: settings.confirmThreshold, maxQuestions: settings.maxQuestions };
      const { post: p, decision } = evaluate(model, s, policy);
      const last = s.evidence[s.evidence.length - 1];
      if (decision.kind === "accept") return finalize(decision.top.candidate, s);
      if (decision.kind === "confirm") {
        setScreen({ kind: "confirm", candidate: decision.top.candidate });
        say(candidateItem(decision.top.candidate, entities, opts, "phrases", phraseAudio));
        say(promptItem("isItSo"));
        return;
      }
      if (needsSlotChoice(model, decision, last) && last?.kind === "frame") {
        return setScreen({ kind: "choices", frame: last.frame, page: 0 });
      }
      if (decision.kind === "ask" && last?.kind === "entity") {
        const actions = entityActionTiles(model, p, last.entity);
        if (preferEntityActions(decision, last, actions)) return setScreen({ kind: "actions", entity: last.entity, page: 0 });
      }
      if (decision.kind === "ask") {
        setScreen({ kind: "question", question: decision.question });
        say(textItem(questionText(decision.question, entities, opts)));
        return;
      }
      if (decision.kind === "grid") {
        setScreen({ kind: "grid", options: decision.options });
        say(promptItem("whichOne"));
        return;
      }
      setScreen(back);
    },
    [model, entities, opts, say, finalize, settings.confirmThreshold, settings.maxQuestions, phraseAudio],
  );

  const addAndAdvance = (e: Evidence, back: Screen) => advance(addEvidence(session, e), back);

  // «Ещё что-то?» звучит после паузы, чтобы она успела повторить фразу.
  const finalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (screen.kind !== "final") return;
    finalTimer.current = setTimeout(() => {
      setAnythingElseShown(true);
      say(promptItem("anythingElse"));
    }, 4500);
    return () => {
      if (finalTimer.current) clearTimeout(finalTimer.current);
    };
  }, [screen.kind, message.length, say]);

  // ---------- постоянная панель ----------

  const onAnswer = (meaning: AnswerMeaning, button: AnswerButton) => {
    say({ text: button.label, audio: button.audio, category: "prompts" }, true);
    switch (screen.kind) {
      case "question":
        return advance(answerQuestion(session, screen.question, meaning), browse);
      case "confirm": {
        if (meaning === "yes") return finalize(screen.candidate, session);
        if (meaning === "almost") return advance(answerQuestion(session, { level: "hypothesis", candidate: screen.candidate }, "almost"), browse);
        if (model) void saveRejection(model, screen.candidate);
        setSession(rejectConfirm(session, screen.candidate));
        return setScreen(browse);
      }
      case "grid":
        if (meaning === "no") return advance(answerGrid(session, screen.options.map((o) => o.key), null), browse);
        return;
      case "final":
        if (meaning === "yes") return setScreen({ kind: "connective" });
        if (meaning === "no") void finishMessage(message, sentEvidence);
        return;
      case "connective":
        if (meaning === "no") void finishMessage(message, sentEvidence);
        return;
      case "didYouSay": {
        const h = screen.series;
        if (meaning === "yes" && h.wordId) {
          const item = wordSound(h.wordId);
          if (item) say(item);
          return advance(addEvidence(session, { kind: "word", word: h.wordId, confidence: 0.95, repeats: h.repeats }), screen.back);
        }
        return setScreen(screen.back);
      }
      default:
        return;
    }
  };

  const wordSound = (wordId: string): SoundItem | null => {
    const w = data?.words.find((x) => x.id === wordId);
    if (!w) return null;
    const text = w.lang === "ru" ? { ru: w.text, kk: w.translation ?? "" } : { kk: w.text, ru: w.translation ?? "" };
    return { text, audio: w.audio ? { [w.lang]: w.audio } : undefined, mode: w.soundMode, develop: w.develop, category: "words" };
  };

  const logAttempt = (h: HeardSeries) =>
    db().attempts.put({
      id: newId("att"),
      at: Date.now(),
      wordId: h.wordId,
      text: h.wordId ? data?.words.find((w) => w.id === h.wordId)?.text : undefined,
      lang: h.wordId ? data?.words.find((w) => w.id === h.wordId)?.lang : undefined,
      kind: "spontaneous",
      confidence: h.confidence,
      mediaId: h.mediaId,
      repeatCount: h.repeats,
    });

  const onSay = async () => {
    if (listening) {
      await listener.current?.stop();
      return;
    }
    speaker.stop();
    const back = screen.kind === "question" || screen.kind === "confirm" || screen.kind === "grid" ? browse : screen;
    setListening(true);
    listener.current = new Listener();
    let pcm: Float32Array;
    try {
      pcm = await listener.current.listen();
    } catch {
      setListening(false);
      return;
    }
    setListening(false);
    const heard = await recognizeRecording(pcm, templates.current);
    for (const h of heard) await logAttempt(h);
    let s = session;
    let unsure: HeardSeries | null = null;
    for (const h of heard) {
      if (!h.wordId) continue;
      if (h.confidence >= 0.6) s = addEvidence(s, { kind: "word", word: h.wordId, confidence: h.confidence, repeats: h.repeats });
      else unsure ??= h;
    }
    const sure = heard.find((h) => h.wordId && h.confidence >= 0.6);
    if (sure?.wordId) {
      const item = wordSound(sure.wordId);
      if (item) say(item, true);
    }
    if (unsure?.wordId && !sure) {
      setSession(s);
      setScreen({ kind: "didYouSay", series: unsure, back });
      const w = data?.words.find((x) => x.id === unsure!.wordId);
      say(textItem({ ru: patientDict("ru").didYouSay.replace("{word}", w?.text ?? ""), kk: patientDict("kk").didYouSay.replace("{word}", w?.text ?? "") }));
      return;
    }
    if (s !== session) advance(s, back);
  };

  const onRestart = () => {
    if (message.length && (screen.kind === "final" || screen.kind === "connective")) void finishMessage(message, sentEvidence);
    else resetAll();
  };

  const onHelp = () => {
    speaker.stop();
    const back = screen.kind === "help" ? screen.back : screen;
    setScreen({ kind: "help", back });
    const phrase = { ru: patientDict("ru").helpPhrase, kk: patientDict("kk").helpPhrase };
    void playAlarm().then(() => say({ text: phrase, category: "prompts", mode: lang === "ru" ? "ru-kk" : "kk-ru" }));
  };

  // ---------- плитки ----------

  const pictureSize = layout.mode === "phone" ? 72 : 120;

  const renderTile = (t: FlowTile, onPage: Screen) => {
    switch (t.kind) {
      case "more":
        return (
          <Tile
            key="more"
            testId="btn-more"
            picture={<Icon id="next" size={pictureSize - 24} />}
            label={d.more}
            sublabel={dOther.more}
            onPress={() => {
              if ("page" in onPage) setScreen({ ...onPage, page: onPage.page + 1 } as Screen);
            }}
          />
        );
      case "topic": {
        const info = topicById(t.topic);
        return (
          <Tile
            key={tileKey(t)}
            testId={`topic-${t.topic}`}
            picture={<Icon id={info?.icon ?? "question"} size={pictureSize} />}
            label={info?.name[lang] ?? t.topic}
            sublabel={info?.name[otherLang]}
            onPress={() => {
              say(topicItem(t.topic), true);
              addAndAdvance({ kind: "topic", topic: t.topic }, { kind: "topic", topic: t.topic, page: 0 });
            }}
          />
        );
      }
      case "candidate": {
        const c = parseCandidateKey(t.key);
        const text = candidateText(c, entities, opts);
        return (
          <Tile
            key={tileKey(t)}
            testId="tile-suggestion"
            picture={<CandidatePicture candidate={c} entities={entities} size={pictureSize} lang={lang} />}
            label={stripEnd(text[lang])}
            sublabel={d.suggestion}
            onPress={() => {
              say(candidateItem(c, entities, opts, undefined, phraseAudio), true);
              addAndAdvance({ kind: "grid", shown: [t.key], picked: t.key }, onPage);
            }}
          />
        );
      }
      case "frame": {
        const f = frameById(t.frame);
        const entityId = onPage.kind === "actions" ? onPage.entity : null;
        const entityType = entityId ? entities.get(entityId)?.type : undefined;
        const slot = entityType ? f?.slots.find((sl) => sl.types.includes(entityType)) : undefined;
        const withEntity: Candidate | null = entityId && slot ? { frame: t.frame, slots: { [slot.name]: entityId } } : null;
        const text = withEntity ? candidateText(withEntity, entities, opts) : frameLabels(t.frame, opts);
        return (
          <Tile
            key={tileKey(t)}
            testId={`frame-${t.frame}`}
            picture={
              withEntity ? (
                <CandidatePicture candidate={withEntity} entities={entities} size={pictureSize} lang={lang} />
              ) : (
                <Icon id={f?.icon ?? "question"} size={pictureSize} />
              )
            }
            label={stripEnd(text[lang])}
            sublabel={stripEnd(text[otherLang])}
            onPress={() => {
              say(withEntity ? candidateItem(withEntity, entities, opts, undefined, phraseAudio) : frameTileItem(t.frame, opts, phraseAudio), true);
              addAndAdvance({ kind: "frame", frame: t.frame }, onPage.kind === "actions" ? browse : onPage);
            }}
          />
        );
      }
      case "entity": {
        const e = entities.get(t.entity);
        if (!e) return null;
        return (
          <Tile
            key={tileKey(t)}
            testId={`entity-${t.entity}`}
            picture={<EntityPicture entity={e} size={pictureSize} lang={lang} />}
            label={e.name[lang] || e.name.ru}
            sublabel={e.name[otherLang]}
            develop={e.develop}
            onPress={() => {
              say(entityItem(e), true);
              addAndAdvance({ kind: "entity", entity: t.entity }, onPage.kind === "choices" ? browse : onPage);
            }}
          />
        );
      }
      case "body":
        return (
          <Tile
            key="body"
            testId="tile-body"
            picture={<Icon id="pain" size={pictureSize} />}
            label={d.whereHurts}
            sublabel={dOther.whereHurts}
            onPress={() => {
              say(promptItem("whereHurts"), true);
              setScreen({ kind: "body", side: "front", page: 0 });
            }}
          />
        );
      case "faces":
        return (
          <Tile
            key="faces"
            testId="tile-faces"
            picture={<FaceSvg level={3} size={pictureSize} />}
            label={d.howDoYouFeel}
            sublabel={dOther.howDoYouFeel}
            onPress={() => {
              say(promptItem("howDoYouFeel"), true);
              setScreen({ kind: "faces", back: onPage });
            }}
          />
        );
    }
  };

  const pagedGrid = (all: FlowTile[], onPage: Screen & { page: number }) => {
    const page = paginate(all, layout.tilesPerPage, onPage.page);
    return (
      <TileGrid cols={layout.cols} rows={layout.rows}>
        {page.tiles.map((t) => renderTile(t, onPage))}
      </TileGrid>
    );
  };

  // ---------- экраны ----------

  const zoneLabels = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of BUILTIN_ENTITIES) if (e.type === "bodypart") m[e.id] = e.name[lang];
    return m;
  }, [lang]);

  const onZone = (zone: string) => {
    const e = entities.get(zone);
    if (e) say(entityItem(e), true);
    setSession((s) => addEvidence(s, { kind: "body", entity: zone }));
    setScreen({ kind: "severity", zone });
    say(promptItem("howStrong"));
  };

  const renderBody = (side: BodySide, page: number) => {
    if (layout.mode === "phone") {
      const zones: FlowTile[] = [...zonesOf(side), "body.skin", ...FACE_PARTS.map((p) => p.entity)].map((z) => ({ kind: "entity", entity: z }));
      const pageTiles = paginate(zones, layout.tilesPerPage, page);
      return (
        <TileGrid cols={layout.cols} rows={layout.rows}>
          {pageTiles.tiles.map((t) =>
            t.kind === "entity" ? (
              <Tile key={t.entity} testId={`zone-${t.entity}`} picture={<BodyMini zone={t.entity} size={80} />} label={zoneLabels[t.entity] ?? ""} onPress={() => onZone(t.entity)} />
            ) : (
              <Tile key="more" testId="btn-more" picture={<Icon id="next" size={48} />} label={d.more} onPress={() => setScreen({ kind: "body", side, page: page + 1 })} />
            ),
          )}
        </TileGrid>
      );
    }
    return (
      <div className="flex h-full gap-6">
        <div className="min-w-0 flex-1">
          <BodyFigure side={side} labels={zoneLabels} onZone={onZone} />
        </div>
        <div className="grid w-[240px] shrink-0 grid-rows-3 gap-6">
          <Tile
            testId="tile-face-parts"
            picture={<Icon id="face" size={pictureSize - 20} />}
            label={d.faceAndThroat}
            sublabel={dOther.faceAndThroat}
            onPress={() => setScreen({ kind: "faceParts" })}
          />
          <Tile testId="zone-body.skin" picture={<Icon id="hand" size={pictureSize - 20} />} label={zoneLabels["body.skin"] ?? ""} onPress={() => onZone("body.skin")} />
          <Tile
            testId="btn-flip"
            picture={<Icon id="flip" size={pictureSize - 20} />}
            label={side === "front" ? d.back_side : d.front}
            sublabel={side === "front" ? dOther.back_side : dOther.front}
            onPress={() => setScreen({ kind: "body", side: side === "front" ? "back" : "front", page: 0 })}
          />
        </div>
      </div>
    );
  };

  const renderFaces = (isSeverity: boolean, back: Screen) => (
    <div className="flex h-full flex-col gap-6">
      <p className="text-center text-[28px] font-semibold">{isSeverity ? d.howStrong : d.howDoYouFeel}</p>
      <div className={`grid min-h-0 flex-1 gap-6 ${layout.mode === "phone" ? "grid-cols-3 grid-rows-2" : "grid-cols-5"}`}>
        {LEVELS.map((level) => (
          <Tile
            key={level}
            testId={`face-${level}`}
            picture={<FaceSvg level={level} size={layout.mode === "phone" ? 72 : 124} />}
            label={isSeverity ? (entities.get(SEVERITY_BY_FACE[level])?.name[lang] ?? "") : d.faces[level]}
            onPress={() => {
              if (isSeverity) {
                const sev = entities.get(SEVERITY_BY_FACE[level]);
                if (sev) say(entityItem(sev), true);
                addAndAdvance({ kind: "severity", level }, { kind: "topic", topic: "health", page: 0 });
              } else {
                say(textItem({ ru: patientDict("ru").faces[level], kk: patientDict("kk").faces[level] }, "feelings"), true);
                addAndAdvance({ kind: "face", level }, back);
              }
            }}
          />
        ))}
      </div>
    </div>
  );

  const renderWork = () => {
    if (!model || !post || !homePrior) return null;
    switch (screen.kind) {
      case "start":
        return null;
      case "home":
        return pagedGrid(homeTiles(model, homePrior, settings.topics), screen);
      case "topic":
        return pagedGrid(topicTiles(model, post, screen.topic), screen);
      case "actions":
        return pagedGrid(entityActionTiles(model, post, screen.entity), screen);
      case "choices":
        return pagedGrid(slotChoiceTiles(model, post, screen.frame), screen);
      case "body":
        return renderBody(screen.side, screen.page);
      case "faceParts":
        return (
          <TileGrid cols={2} rows={2}>
            {FACE_PARTS.map((p) => (
              <Tile key={p.entity} testId={`zone-${p.entity}`} picture={<Icon id={p.icon} size={pictureSize} />} label={zoneLabels[p.entity] ?? ""} onPress={() => onZone(p.entity)} />
            ))}
          </TileGrid>
        );
      case "severity":
        return renderFaces(true, browse);
      case "faces":
        return renderFaces(false, screen.back);
      case "question": {
        const q = screen.question;
        const text = questionText(q, entities, opts);
        const e = q.level === "slot" ? entities.get(q.entity) : undefined;
        const picture =
          q.level === "topic" ? (
            <Icon id={topicById(q.topic)?.icon ?? "question"} size={200} />
          ) : q.level === "hypothesis" ? (
            <CandidatePicture candidate={q.candidate} entities={entities} size={200} lang={lang} />
          ) : e ? (
            <EntityOrBody entity={e} size={200} lang={lang} />
          ) : null;
        return <Prompt picture={picture} text={text} lang={lang} replayLabel={d.again} onReplay={() => say(textItem(text), true)} testId="screen-question" compact={layout.mode === "phone"} />;
      }
      case "confirm": {
        const text = candidateText(screen.candidate, entities, opts);
        return (
          <Prompt
            picture={<CandidatePicture candidate={screen.candidate} entities={entities} size={200} lang={lang} />}
            text={text}
            lang={lang}
            tail={d.isItSo}
            replayLabel={d.again}
            onReplay={() => {
              say(textItem(text, "phrases"), true);
              say(promptItem("isItSo"));
            }}
            testId="screen-confirm"
            compact={layout.mode === "phone"}
          />
        );
      }
      case "grid": {
        const options = screen.options;
        return (
          <TileGrid cols={2} rows={2}>
            {options.map((o) => {
              const text = candidateText(o.candidate, entities, opts);
              return (
                <Tile
                  key={o.key}
                  testId={`grid-${o.key}`}
                  picture={<CandidatePicture candidate={o.candidate} entities={entities} size={layout.mode === "phone" ? 64 : 110} lang={lang} />}
                  label={stripEnd(text[lang])}
                  onPress={() => {
                    say(candidateItem(o.candidate, entities, opts, undefined, phraseAudio), true);
                    advance(answerGrid(session, options.map((x) => x.key), o.key), browse);
                  }}
                />
              );
            })}
          </TileGrid>
        );
      }
      case "final": {
        const text = bothTexts(message);
        return (
          <FinalPhrase
            message={message}
            entities={entities}
            text={text}
            lang={lang}
            labels={{ again: d.again, other: lang === "ru" ? d.kazakhToo : d.russianToo, repeat: d.repeatPlease, anythingElse: d.anythingElse }}
            showAnythingElse={anythingElseShown}
            onAgain={() => say(textItem(text, "phrases"), true)}
            onOther={() => void speaker.speak([{ lang: otherLang, text: text[otherLang] }], { interrupt: true })}
            compact={layout.mode === "phone"}
          />
        );
      }
      case "connective":
        return (
          <TileGrid cols={layout.mode === "phone" ? 2 : 3} rows={layout.mode === "phone" ? 3 : 2}>
            {CONNECTIVES.map((c) => (
              <Tile
                key={c}
                testId={`conn-${c}`}
                picture={<ConnectiveGlyph id={c} size={pictureSize - 20} />}
                label={d.connectives[c]}
                sublabel={dOther.connectives[c]}
                onPress={() => {
                  say(textItem({ ru: patientDict("ru").connectives[c], kk: patientDict("kk").connectives[c] }, "phrases"), true);
                  setPendingConnective(c);
                  setSession(newSession());
                  setBrowse({ kind: "home", page: 0 });
                  setScreen({ kind: "home", page: 0 });
                }}
              />
            ))}
            <Tile testId="conn-done" picture={<Icon id="check" size={pictureSize - 20} />} label={d.done} sublabel={dOther.done} onPress={() => void finishMessage(message, sentEvidence)} />
          </TileGrid>
        );
      case "didYouSay": {
        const w = data?.words.find((x) => x.id === screen.series.wordId);
        const text = {
          ru: patientDict("ru").didYouSay.replace("{word}", w?.text ?? ""),
          kk: patientDict("kk").didYouSay.replace("{word}", w?.text ?? ""),
        };
        return (
          <Prompt
            picture={<span className="text-[72px] leading-none font-semibold text-accent">{w?.text}</span>}
            text={text}
            lang={lang}
            replayLabel={d.again}
            onReplay={() => {
              const item = w ? wordSound(w.id) : null;
              if (item) say(item, true);
            }}
            testId="screen-did-you-say"
            compact={layout.mode === "phone"}
          />
        );
      }
      case "help":
        return (
          <div className="flex h-full flex-col items-center justify-center gap-6 rounded-3xl border-4 border-help bg-surface p-6 text-center" data-testid="screen-help">
            <Icon id="bell" size={140} />
            <p className="text-[44px] leading-tight font-semibold text-help">{patientDict(lang).helpPhrase}</p>
            <p className="text-[26px] text-ink-2">{patientDict(otherLang).helpPhrase}</p>
            <Press
              label={d.back}
              testId="btn-help-back"
              onPress={() => setScreen(screen.back)}
              className="mt-4 flex min-h-[120px] min-w-[240px] items-center justify-center rounded-3xl border-2 border-line bg-surface-2 text-[22px] font-semibold"
            >
              {d.back}
            </Press>
          </div>
        );
    }
  };

  const unlock = useCallback(() => setPinOpen(true), []);

  return (
    <div className="patient-root bg-bg text-ink" data-screen={screen.kind}>
      <CornerHold onUnlock={unlock} side={settings.hand === "right" ? "left" : "right"} />
      {screen.kind === "start" ? (
        <div className="flex h-full items-center justify-center p-6">
          <Press
            label={d.start}
            testId="btn-start"
            onPress={() => {
              speaker.stop();
              setScreen({ kind: "home", page: 0 });
              say(textItem({ ru: patientDict("ru").start, kk: patientDict("kk").start }));
            }}
            className="flex h-[min(60vh,420px)] w-[min(80vw,520px)] flex-col items-center justify-center gap-4 rounded-[40px] bg-accent text-accent-ink"
          >
            <Icon id="smile" size={140} />
            <span className="text-[34px] font-semibold">{d.start}</span>
            <span className="text-[20px] opacity-90">{dOther.start}</span>
          </Press>
        </div>
      ) : (
        <Shell
          settings={settings}
          layout={layout}
          handlers={{ onHelp, onRestart, onAnswer, onSay: () => void onSay(), listening }}
        >
          {renderWork()}
        </Shell>
      )}
      {pinOpen && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-bg/95 p-6" style={{ touchAction: "auto" }}>
          <PinForm settings={settings} onOk={() => window.location.assign(href("/care/"))} onCancel={() => setPinOpen(false)} />
        </div>
      )}
    </div>
  );
}

/** Вопрос или «Так?»: картинка, текст крупно для собеседника, повтор голосом. */
function Prompt({
  picture,
  text,
  lang,
  tail,
  replayLabel,
  onReplay,
  testId,
  compact,
}: {
  picture: React.ReactNode;
  text: { ru: string; kk: string };
  lang: Lang;
  tail?: string;
  replayLabel: string;
  onReplay: () => void;
  testId: string;
  compact: boolean;
}) {
  const other: Lang = lang === "ru" ? "kk" : "ru";
  return (
    <div className={`flex h-full gap-6 ${compact ? "flex-col" : "flex-row"}`} data-testid={testId}>
      <div className={`flex min-h-0 flex-1 items-center gap-8 rounded-3xl border-2 border-line bg-surface p-6 ${compact ? "flex-col justify-center" : ""}`}>
        <div className="shrink-0">{picture}</div>
        <div className="flex min-w-0 flex-col gap-3">
          <p className={`${compact ? "text-[26px]" : "text-[40px]"} leading-[1.15] font-semibold tracking-[-0.01em]`} lang={lang}>
            {text[lang]}
            {tail && <span className="text-accent"> {tail}</span>}
          </p>
          <p className="text-[20px] leading-snug text-ink-2" lang={other}>
            {text[other]}
          </p>
        </div>
      </div>
      <div className={`${compact ? "h-[120px]" : "w-[200px]"} grid shrink-0`}>
        <Tile testId="btn-replay" picture={<Icon id="speaker" size={64} />} label={replayLabel} onPress={onReplay} />
      </div>
    </div>
  );
}

/** Итоговая фраза: крупно для собеседника, второй язык ниже, узор-разделитель. */
function FinalPhrase({
  message,
  entities,
  text,
  lang,
  labels,
  showAnythingElse,
  onAgain,
  onOther,
  compact,
}: {
  message: MessageSentence[];
  entities: ReadonlyMap<string, Entity>;
  text: { ru: string; kk: string };
  lang: Lang;
  labels: { again: string; other: string; repeat: string; anythingElse: string };
  showAnythingElse: boolean;
  onAgain: () => void;
  onOther: () => void;
  compact: boolean;
}) {
  const other: Lang = lang === "ru" ? "kk" : "ru";
  const last = message[message.length - 1];
  return (
    <div className="flex h-full flex-col gap-6" data-testid="screen-final">
      <div className={`flex min-h-0 flex-1 items-center gap-8 rounded-3xl bg-surface p-6 ${compact ? "flex-col justify-center" : ""}`}>
        {last && <CandidatePicture candidate={last.candidate} entities={entities} size={compact ? 120 : 200} lang={lang} />}
        <div className="flex min-w-0 flex-col gap-4">
          <p className={`${compact ? "text-[28px]" : "text-[52px]"} leading-[1.08] font-semibold tracking-[-0.015em]`} lang={lang} data-testid="final-text">
            {text[lang]}
          </p>
          <Ornament />
          <p className={`${compact ? "text-[20px]" : "text-[30px]"} leading-snug text-accent`} lang={other}>
            {text[other]}
          </p>
          <p className="text-[20px] text-ink-2">{showAnythingElse ? labels.anythingElse : labels.repeat}</p>
        </div>
      </div>
      <div className={`grid shrink-0 grid-cols-2 gap-6 ${compact ? "h-[130px]" : "h-[150px]"}`}>
        <Tile testId="btn-again" picture={<SpeakerLang size={56} />} label={labels.again} onPress={onAgain} />
        <Tile testId="btn-other-lang" picture={<SpeakerLang size={56} lang={other} />} label={labels.other} onPress={onOther} />
      </div>
    </div>
  );
}

/** Узор «қошқар мүйіз» одной линией — единственное украшение в приложении. */
function Ornament() {
  return (
    <svg width="220" height="28" viewBox="0 0 220 28" aria-hidden className="text-accent">
      <path
        d="M2 14 H80 C86 14 88 4 96 4 C104 4 104 14 98 16 C93 18 90 12 95 10 M110 14 C110 4 100 2 96 4 M110 14 C110 4 120 2 124 4 C132 4 132 14 126 16 C121 18 118 12 123 10 M124 4 C132 4 134 14 140 14 H218"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
