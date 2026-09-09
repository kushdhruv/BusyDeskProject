# Assignment 04 — Support Ticketing

## The scenario

Picture a small software company fielding a growing stream of customer support requests — bug
reports, billing questions, plain "how do I" questions — that currently arrive by email and get
handled ad hoc. Whoever notices an email first replies to it, sometimes twice, sometimes not at all.

The result is predictable. A customer emails three times about the same issue because nobody can
tell it is already being worked on by someone else. A ticket sits untouched for two weeks because
the one person who understood it went on leave and nobody else picked it up. Leadership cannot say
how many requests are currently open, or which ones are about to breach the response time promised
to the customer, because answering either question means opening every email and checking a
timestamp by hand.

They want one shared queue: agents pick up tickets, reply, and move them through a clear lifecycle,
while a supervisor can reassign work and see the whole queue at once. Anyone should be able to tell
which tickets are at risk of breaching their response commitment without scanning every open ticket
by hand. Build the shared queue that replaces the group inbox.

## What it must do

Everything below is required. Several of the ten spell out exact rules — what happens on an illegal
move, what a bulk action must report back, when a dismissed alert is allowed to reappear — and those
specifics are the actual ask, not just the bold headline in front of them.

1. **Accounts and roles.** People sign in with an email and password, and there are at least two
roles — a supervisor role and an agent role. Supervisors can reassign any ticket to any agent, close
tickets, and see the entire queue. Agents can only act on tickets where they are the primary
assignee or a collaborator, and cannot reassign a ticket away from themselves. The difference must
be enforced on the server, not just hidden in the interface.

2. **Tickets.** Agents and supervisors create tickets with a subject, a description, a requester, a
priority and a category, and can edit them later. Tickets can be archived and restored. Archiving
removes a ticket from every default queue view without destroying its history.

3. **Replies inside tickets.** Every reply belongs to exactly one ticket and carries a message body,
an author, a timestamp, and a flag marking it as an internal note or a customer-visible reply.
Replies can be added to a ticket at any time. Opening a ticket shows all of its replies in order.

4. **Ticket lifecycle.** A ticket moves through *New → Open → Pending → Resolved → Closed*,
with its response clock measured against a target response time set by its priority. Pending
specifically means the ticket is waiting on a reply from the customer, and the clock pauses for as
long as a ticket sits in Pending rather than continuing to run against the agent; a customer reply
returns the ticket to Open and resumes the clock. A Closed ticket can only be reopened within a
fixed window afterward — once that window passes, it stays closed. Any other move must be rejected
by the server with a message explaining why.

5. **Collaborators.** A ticket has one primary assignee, but any number of other agents can be added
to it as collaborators who can also reply and update it, and a single agent can collaborate on any
number of tickets. Every agent can see one list of every ticket where they are the primary assignee
or a collaborator.

6. **Finding tickets.** One list shows the queue with a text search over subject and description,
filters for status, priority, category and assignee, sorting by created date, priority or last
update, and pagination showing the total number of matches. All of this must happen on the server —
do not load every ticket into the browser and filter there.

7. **Acting on many tickets at once.** Select several tickets from the queue and bulk-reassign them
to a different agent, or bulk-close them, in one action. Because some tickets in the selection may
not be eligible for the move, the result must report per ticket what succeeded and what was refused
and why, not just fail the whole batch. Separately, export the currently filtered queue as a CSV
file.

8. **A dashboard.** A landing view shows headline numbers — open tickets, tickets pending on the
customer, resolved this week, breaching their response time. It also breaks tickets down by status
and by agent, and charts tickets resolved per week over the last eight weeks.

9. **History you cannot rewrite.** Every ticket has a timeline showing every status change with the
old and new status and who made it, every reassignment, and every reply, internal or
customer-visible. Nothing in this timeline can be edited or deleted after the fact, including by
supervisors.

10. **SLA alerts.** Any ticket whose response clock has passed its target response time, or is
within a short window of doing so, appears in an alerts area, with a count badge visible in the
navigation. An agent can acknowledge an alert for a ticket assigned to them, clearing it from the
list. If the ticket is later reopened and breaches its target response time again, the alert
returns.

## Stretch ideas (optional)

None of these are required, and none substitute for a goal above. If you finish all ten with time
left over, pick whichever of these sounds most useful and build it:

- A canned-response library for common replies.
- A post-resolution customer satisfaction rating.
- A public status page for ongoing incidents.
- Free-form tagging of tickets.
- An internal knowledge base linked from tickets.
- Automatic routing of new tickets by category.
- Merging duplicate tickets.
- SLA policies that vary by priority.
- An email digest of the daily queue.


---

## What we are assessing

A working application is table stakes. Almost every serious candidate will produce something that runs, has a login, and roughly does what was asked. That's the floor, not the differentiator.

What actually separates submissions is the record of thinking behind the app: the decisions you made and why, the trade-offs you weighed, what you built first and what you deliberately left out, and whether you can explain any part of your own system when asked. We are hiring for judgement. The app is the evidence for that judgement, not the deliverable in itself.

We also read the code itself for structure and readability, which counts for a small share of the overall score.

## Time budget

Budget about 12 hours total, spent roughly 2 hours a day across a week.

This is not a race. We are not timing you against other candidates, and submitting early scores nothing extra. Twelve hours is a size guide so you know how much to attempt — pace yourself, stop when you're tired, and spend some of that time thinking and documenting, not only typing code.

## Pick any stack you like

Use any language, any framework, any UI library, any ORM, and any database access approach you want. We have no house stack, and no stack scores better than another — this round is not a test of whether you know particular tools.

Use whatever you are fastest and most confident in. Time spent learning something new to impress us is time not spent on the ten goals above, and it will show.

## Using AI is allowed and encouraged

Use AI tools however you want — to scaffold code, debug a stuck problem, write tests, draft documentation, or anything else that helps you move faster. A few things to know about how we treat it:

- We do not penalise AI use, and we make no attempt to detect it.
- We care about whether you understood, directed and verified the output — not about who or what produced the first draft of it.
- `docs/ai-prompts.md` must contain the prompts you actually used, including the ones that produced bad output and what you changed afterwards. If you used no AI at all, say so here and describe how you worked instead — that is assessed the same way.
- Submitting generated code you cannot explain is the single most common way candidates fail this round.

You are accountable for everything in your submission. If a reviewer points at a piece of code and asks why it's there, or why it works the way it does, "the AI wrote it" is not an answer.

## Use git properly

Publish to a public GitHub repository, and commit incrementally as the work actually happens — after each meaningful step, not in one pass at the end.

A repository whose entire history is a single "initial commit" containing a finished app scores zero on git history, and it colours how we read everything else in your submission, however good the app itself is. Your history is how we see the order you built in, where you got stuck, and how the design changed along the way. If it isn't there, we can't assess it, and we won't assume the best.

## What you must commit

Alongside your code, commit these five files under `docs/`. Your zip includes a stub for each with the questions it needs to answer — fill them in as you go, not from memory at the end.

| File | What it must answer |
|------|----------------------|
| `docs/architecture.md` | What the moving pieces are, how they talk to each other, where each one runs, the request path for one representative user action end to end, and what you decided not to build. |
| `docs/schema.md` | Every table's columns and types, which relationships are one-to-many versus many-to-many, which constraints live in the database versus the application, what you deliberately denormalised, and what would break first at 100x the data. |
| `docs/plan.md` | How you split the work into sessions, what order you built in and why, what you estimated versus what it actually took, and what you cut when you ran short. |
| `docs/decisions.md` | At least five real decisions — what you chose, what you rejected, and why — including at least one you later reversed. |
| `docs/ai-prompts.md` | The prompts you actually used, in order, grouped by what you were trying to do, including at least one that produced something wrong and what you did about it. |

## Host it for free

Deploy the whole thing somewhere reachable by URL, using free tiers only.

One combination that works, if you would rather not decide:

- **Database** — a managed service such as Supabase.
- **Server-side code** — Render.
- **Browser-side code** — Vercel.

Deploy in that order: create the database first, give the server its connection details as environment variables, then point the browser-side part at the server's public URL.

This is one option, not a requirement. Any free host is equally acceptable — everything on a single provider, one virtual machine, a container platform, a static host with serverless functions. The choice earns and loses nothing.

Requirements:

- A working live URL.
- Seeded with enough demo data to show the system doing something, not an empty shell.
- Demo credentials for every role recorded in `SUBMISSION.md`.
- Connection strings, keys and passwords kept in environment variables, never in the repository.
- Free tiers often sleep when idle and can take a minute or more to wake. Note it in `SUBMISSION.md` if yours does, so a slow first load is not read as a broken deployment.
- If you cannot get it hosted, submit anyway and record in `SUBMISSION.md` what you tried and where it broke.

## How to submit

Send us:

- The URL of your public GitHub repository.
- The URL of your live, deployed application.
- Your completed `SUBMISSION.md`, committed to the repository.

That's the whole submission. Nothing else to prepare, no separate form.

## What happens next

If your submission clears the bar, we'll set up a short call. We will ask about specific decisions we can see in your repository and its history — why you modelled something a particular way, what a certain commit was fixing, what you'd change if you kept going.

We're telling you this now because it should change how carefully you document as you go. Write `docs/decisions.md` for a version of yourself who has to explain it three weeks from now.

## Scope

The 10 goals stated in this brief are the cutoff. Meet all 10, solidly, and you have a complete submission.

Stretch ideas are optional. They exist for candidates who finish the 10 with time left and want to keep building — they are never required, and they do not make up for a goal you didn't hit. Doing 8 goals well beats doing 10 goals badly. If time is short, finish fewer goals properly rather than leaving all ten half-done.
