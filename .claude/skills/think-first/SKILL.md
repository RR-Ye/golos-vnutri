---
name: think-first
description: "Use before any non-trivial build, plan, decision, or piece of analysis for Aldi. Forces a plan and an explicit challenge pass before execution, and a verification pass before claiming done."
---

# Think first

The failure mode this skill exists to prevent: jumping straight to output, producing something plausible-looking that solves the wrong problem, and calling it done.

## 1. Restate before building

In two or three sentences, before any tool call that produces output:

- What is actually being asked, in your own words.
- What the finished thing looks like (format, length, who reads it).
- What you are assuming because it wasn't stated.

If two readings of the request lead to materially different work, name both and pick one, saying why. Don't silently pick.

## 2. Challenge the plan

Before executing, attack your own plan once:

- What is the simplest version that would satisfy the request? Is the extra complexity earning its place?
- What would make this wrong? Name the specific way it fails.
- What am I about to build that nobody asked for?
- Is there an existing thing (file, project, prior decision) this should match instead of reinventing?

The answer to "is the extra complexity earning its place" is usually no. Cut it.

## 3. Surgical changes only

When editing something that exists: change what was asked and nothing else. Don't refactor adjacent code, don't restyle sections that were fine, don't "improve" wording that wasn't the subject. Unrequested changes are noise Aldi has to review.

## 4. Verify before claiming done

Never say something works, is finished, or is correct without checking:

- Code: run it. A build that compiles is not a feature that works.
- Numbers: recompute them a second way, or in a script.
- Facts about the present world (prices, deadlines, who holds a role, whether a program still exists): search. Training data does not know.
- Visual output: look at it — screenshot or render — before describing it as good.

If verification isn't possible, say what you couldn't verify. "Should work" is a red flag; write "I ran X and got Y" or write nothing.

## 5. Report honestly

- Lead with the outcome, not the process.
- Flag what's shaky. If part of the answer is a guess, mark that part.
- If you couldn't do something, say so plainly in one sentence and move on — no apology spiral.
- Never pad with recaps of steps Aldi watched you take.

## When to skip this

One-line factual answers and simple conversation. Everything else — a build, a plan, an analysis, a decision, a document — runs the loop.