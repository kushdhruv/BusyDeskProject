/**
 * Agent & Setup Account Routes
 * Handles agent invitations, invitation validation, account setup, and team directory.
 */

import { NextResponse } from "next/server";
import { getSessionUser, setSessionCookie } from "@/middlewares/auth.middleware";
import { AgentController } from "@/controllers/agent.controller";
import { SetupAccountController } from "@/controllers/setup-account.controller";

/**
 * POST /api/agents/invite
 * Supervisor invites a new agent with a 24-hour single-use token.
 */
export async function inviteAgentRoute(req: Request): Promise<NextResponse> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== "SUPERVISOR") {
      return NextResponse.json(
        { error: "Forbidden: Only supervisors can invite new agents." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = await AgentController.inviteAgent(sessionUser, {
      name: body.name,
      email: body.email,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to invite agent." },
      { status: error.message?.includes("already exists") ? 409 : 400 }
    );
  }
}

/**
 * POST /api/agents/[id]/resend-invite
 * Supervisor resends an invitation with a fresh 24-hour token.
 */
export async function resendInviteRoute(
  _req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== "SUPERVISOR") {
      return NextResponse.json(
        { error: "Forbidden: Only supervisors can resend invitations." },
        { status: 403 }
      );
    }

    const result = await AgentController.resendInvitation(sessionUser, params.id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to resend invitation." },
      { status: 400 }
    );
  }
}

/**
 * GET /api/agents
 * Retrieves internal team directory with roles, statuses, and live ticket workloads.
 */
export async function getTeamDirectoryRoute(): Promise<NextResponse> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const team = await AgentController.getTeamDirectory(sessionUser);
    return NextResponse.json({ team });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to retrieve team directory." },
      { status: error.message?.includes("Forbidden") ? 403 : 400 }
    );
  }
}

/**
 * GET /api/auth/invitation?token=...
 * Validates a one-time setup token without consuming it.
 */
export async function validateInvitationRoute(req: Request): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";

    const validation = await SetupAccountController.validateInvitationToken(token);
    return NextResponse.json(validation);
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, error: error.message || "Failed to validate invitation." },
      { status: 400 }
    );
  }
}

/**
 * POST /api/auth/setup-account
 * Consumes the one-time token, sets the agent's password, activates the account,
 * and sets an authenticated session cookie.
 */
export async function setupAccountRoute(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Invitation token and password are required." },
        { status: 400 }
      );
    }

    const user = await SetupAccountController.completeAccountSetup(token, password);
    await setSessionCookie(user);

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Account setup failed." },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/agents/[id]
 * Supervisor updates an agent's role (SUPERVISOR <-> AGENT) and/or account status (ACTIVE <-> SUSPENDED),
 * with optional bulk ticket reassignment.
 */
export async function updateAgentRoute(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== "SUPERVISOR") {
      return NextResponse.json(
        { error: "Forbidden: Only supervisors can manage agent permissions and account statuses." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = await AgentController.updateAgent(sessionUser, params.id, {
      role: body.role,
      status: body.status,
      reassignTicketsToId: body.reassignTicketsToId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update agent." },
      { status: error.message?.includes("Forbidden") ? 403 : 400 }
    );
  }
}

/**
 * DELETE /api/agents/[id]
 * Supervisor cancels a pending agent invitation.
 */
export async function cancelAgentInvitationRoute(
  _req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== "SUPERVISOR") {
      return NextResponse.json(
        { error: "Forbidden: Only supervisors can cancel agent invitations." },
        { status: 403 }
      );
    }

    const result = await AgentController.cancelInvitation(sessionUser, params.id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to cancel invitation." },
      { status: error.message?.includes("Forbidden") ? 403 : 400 }
    );
  }
}
