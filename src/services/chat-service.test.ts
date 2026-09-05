import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashPassword } from "@/lib/auth/password";
import {
  conversationRoom,
  messageSendSchema,
  organizationInboxRoom,
} from "@/lib/chat/socket-events";
import { prisma } from "@/lib/db/prisma";
import { presenceService } from "@/socket/presence";
import { organizationRepository } from "@/repositories/organization-repository";
import { ChatServiceError, chatService } from "@/services/chat-service";

const runIntegration = Boolean(process.env.DATABASE_URL);

describe("socket event contracts", () => {
  it("builds tenant-safe rooms", () => {
    expect(conversationRoom("org-a", "conv-1")).toBe("org:org-a:conversation:conv-1");
    expect(organizationInboxRoom("org-a")).toBe("org:org-a:inbox");
    expect(conversationRoom("org-a", "conv-1")).not.toBe(conversationRoom("org-b", "conv-1"));
  });

  it("rejects invalid message payloads", () => {
    expect(
      messageSendSchema.safeParse({
        conversationId: "c1",
        body: "hi",
        clientMessageId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      messageSendSchema.safeParse({
        conversationId: "c1",
        body: "hello",
        clientMessageId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(true);
  });
});

describe.runIf(runIntegration)("chatService integration", () => {
  const suffix = Date.now();
  let ownerA = "";
  let ownerB = "";
  let viewerA = "";
  let orgA = "";
  let orgB = "";
  let customerA = "";
  let customerB = "";
  let ticketA = "";
  let conversationId = "";

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "test-secret-ticketloom-auth-32chars!!";
    const passwordHash = await hashPassword("SecurePass123!");

    const userA = await prisma.user.create({
      data: { email: `owner-m8a-${suffix}@example.com`, name: "Owner A", passwordHash },
    });
    ownerA = userA.id;
    const userB = await prisma.user.create({
      data: { email: `owner-m8b-${suffix}@example.com`, name: "Owner B", passwordHash },
    });
    ownerB = userB.id;
    const viewer = await prisma.user.create({
      data: { email: `viewer-m8-${suffix}@example.com`, name: "Viewer A", passwordHash },
    });
    viewerA = viewer.id;

    const createdA = await organizationRepository.createWithOwner({
      name: `Chat Org A ${suffix}`,
      ownerUserId: ownerA,
      slug: `chat-a-${suffix}`,
    });
    orgA = createdA.organization.id;
    const createdB = await organizationRepository.createWithOwner({
      name: `Chat Org B ${suffix}`,
      ownerUserId: ownerB,
      slug: `chat-b-${suffix}`,
    });
    orgB = createdB.organization.id;

    await organizationRepository.createMembership({
      userId: viewerA,
      organizationId: orgA,
      role: "VIEWER",
      status: "ACTIVE",
    });
    await prisma.user.update({
      where: { id: viewerA },
      data: { activeOrganizationId: orgA },
    });

    const customer = await prisma.customer.create({
      data: {
        organizationId: orgA,
        name: "Chat Customer",
        email: `chat-customer-${suffix}@example.com`,
      },
    });
    customerA = customer.id;

    const foreignCustomer = await prisma.customer.create({
      data: {
        organizationId: orgB,
        name: "Foreign Customer",
        email: `foreign-customer-${suffix}@example.com`,
      },
    });
    customerB = foreignCustomer.id;

    const ticket = await prisma.ticket.create({
      data: {
        organizationId: orgA,
        number: 900001,
        numberKey: "TKT-900001",
        subject: "Need chat help",
        description: "Please assist",
        customerId: customerA,
        createdById: ownerA,
      },
    });
    ticketA = ticket.id;
  });

  afterAll(async () => {
    await prisma.messageReadState.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.chatMessage.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.conversationActivity.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.conversationParticipant.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.conversation.deleteMany({
      where: { organizationId: { in: [orgA, orgB] } },
    });
    await prisma.ticket.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.membership.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerA, ownerB, viewerA] } } });
    await prisma.$disconnect();
  });

  it("creates conversation linked to ticket and customer", async () => {
    const conversation = await chatService.create(ownerA, {
      customerId: customerA,
      ticketId: ticketA,
      subject: "Support thread",
    });
    conversationId = conversation.id;
    expect(conversation.organizationId).toBe(orgA);
    expect(conversation.customerId).toBe(customerA);
    expect(conversation.ticketId).toBe(ticketA);

    const again = await chatService.getOrCreateForTicket(ownerA, ticketA);
    expect(again.id).toBe(conversationId);
  });

  it("persists messages with acknowledgements and idempotent client ids", async () => {
    const clientMessageId = "22222222-2222-4222-8222-222222222222";
    const first = await chatService.sendMessage(ownerA, {
      conversationId,
      body: "Hello from agent",
      clientMessageId,
    });
    expect(first.created).toBe(true);
    expect(first.message.body).toBe("Hello from agent");

    const duplicate = await chatService.sendMessage(ownerA, {
      conversationId,
      body: "Hello from agent",
      clientMessageId,
    });
    expect(duplicate.created).toBe(false);
    expect(duplicate.message.id).toBe(first.message.id);

    const history = await chatService.listMessages(ownerA, conversationId, { limit: 20 });
    expect(history.items.some((item) => item.id === first.message.id)).toBe(true);
  });

  it("paginates message history", async () => {
    for (let i = 0; i < 5; i += 1) {
      await chatService.sendMessage(ownerA, {
        conversationId,
        body: `Msg ${i}`,
        clientMessageId: `33333333-3333-4333-8333-33333333333${i}`,
      });
    }
    const page1 = await chatService.listMessages(ownerA, conversationId, { limit: 3 });
    expect(page1.items.length).toBe(3);
    expect(page1.hasMore).toBe(true);
    const page2 = await chatService.listMessages(ownerA, conversationId, {
      limit: 3,
      cursor: page1.nextCursor ?? undefined,
    });
    expect(page2.items.length).toBeGreaterThan(0);
  });

  it("tracks read receipts and unread counts", async () => {
    const sent = await chatService.sendMessage(ownerA, {
      conversationId,
      body: "Unread for viewer",
      clientMessageId: "44444444-4444-4444-8444-444444444444",
    });

    await prisma.user.update({
      where: { id: viewerA },
      data: { activeOrganizationId: orgA },
    });

    // Viewer can read but not send
    await expect(
      chatService.sendMessage(viewerA, {
        conversationId,
        body: "nope",
        clientMessageId: "55555555-5555-4555-8555-555555555555",
      }),
    ).rejects.toBeTruthy();

    const unreadBefore = await chatService.unreadCounts(viewerA);
    expect((unreadBefore[conversationId] ?? 0) >= 1).toBe(true);

    const read = await chatService.markRead(viewerA, {
      conversationId,
      messageId: sent.message.id,
    });
    expect(read.unreadCount).toBe(0);
  });

  it("assigns only verified org members", async () => {
    await expect(
      chatService.assign(ownerA, { conversationId, assigneeId: ownerB }),
    ).rejects.toMatchObject({ code: "VALIDATION" } satisfies Partial<ChatServiceError>);

    const assigned = await chatService.assign(ownerA, {
      conversationId,
      assigneeId: viewerA,
    });
    expect(assigned.assignedAgentId).toBe(viewerA);
  });

  it("blocks cross-tenant conversation access", async () => {
    await expect(chatService.get(ownerB, conversationId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(chatService.assertCanJoin(ownerB, conversationId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      chatService.sendMessage(ownerB, {
        conversationId,
        body: "intrusion",
        clientMessageId: "66666666-6666-4666-8666-666666666666",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      chatService.create(ownerA, { customerId: customerB }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("prevents VIEWER from creating conversations", async () => {
    await prisma.user.update({
      where: { id: viewerA },
      data: { activeOrganizationId: orgA },
    });
    await expect(
      chatService.create(viewerA, { customerId: customerA }),
    ).rejects.toBeTruthy();
  });

  it("lists conversations for customer integration", async () => {
    const list = await chatService.listForCustomer(ownerA, customerA);
    expect(list.some((item) => item.id === conversationId)).toBe(true);
  });

  it("soft-deletes and edits own messages", async () => {
    const sent = await chatService.sendMessage(ownerA, {
      conversationId,
      body: "editable",
      clientMessageId: "77777777-7777-4777-8777-777777777777",
    });
    const edited = await chatService.editMessage(ownerA, {
      conversationId,
      messageId: sent.message.id,
      body: "edited",
    });
    expect(edited.message.body).toBe("edited");
    expect(edited.message.editedAt).toBeTruthy();

    const deleted = await chatService.deleteMessage(ownerA, {
      conversationId,
      messageId: sent.message.id,
    });
    expect(deleted.message.deletedAt).toBeTruthy();
    expect(deleted.message.body).toBe("");
  });
});

describe.runIf(Boolean(process.env.REDIS_URL))("presence redis", () => {
  it("keeps user online across multiple connections", async () => {
    const orgId = `org-presence-${Date.now()}`;
    const userId = `user-presence-${Date.now()}`;
    const first = await presenceService.trackConnect(orgId, userId, "sock-1");
    expect(first.online).toBe(true);
    await presenceService.trackConnect(orgId, userId, "sock-2");
    const afterOne = await presenceService.trackDisconnect(orgId, userId, "sock-1");
    expect(afterOne.online).toBe(true);
    const afterTwo = await presenceService.trackDisconnect(orgId, userId, "sock-2");
    expect(afterTwo.online).toBe(false);
  });
});
