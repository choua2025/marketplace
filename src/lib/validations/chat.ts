import { z } from "zod";

export const startConversationSchema = z.object({
  providerId: z.string().min(1),
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;

export const sendMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(2000).optional(),
    imageKey: z.string().min(1).optional(),
  })
  .refine((data) => data.body !== undefined || data.imageKey !== undefined, {
    message: "A message needs a body or an image.",
    path: ["body"],
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const MESSAGES_PAGE_SIZE = 30;

export const listMessagesSchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
});

export type ListMessagesInput = z.infer<typeof listMessagesSchema>;
