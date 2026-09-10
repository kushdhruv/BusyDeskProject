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

4. **Ticket lifecycle.** A ticket moves through _New → Open → Pending → Resolved → Closed_,
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
