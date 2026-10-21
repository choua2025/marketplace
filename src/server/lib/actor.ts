export type Role = "customer" | "provider" | "admin";

/** The authenticated user calling a service, or null for an anonymous visitor. */
export interface Actor {
  id: string;
  role: Role;
}
