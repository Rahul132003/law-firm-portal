"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = {
  error?: string;
};

/**
 * Credentials sign-in. On success `signIn` throws a redirect, which must be
 * allowed to propagate — hence the rethrow of anything that is not an
 * AuthError.
 */
export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Please enter your email and password." };
  }

  if (!email.trim() || !password) {
    return { error: "Please enter your email and password." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately identical wording for unknown-email, wrong-password and
      // deactivated-account, so the form cannot be used to enumerate staff.
      if (error.type === "CredentialsSignin") {
        if ((error as { code?: string }).code === "locked") {
          return {
            error:
              "Too many failed sign-in attempts. Please wait a while and try again, or ask a partner to unlock your account.",
          };
        }
        return { error: "Invalid email or password." };
      }
      return { error: "Unable to sign in. Please try again." };
    }

    throw error;
  }

  return {};
}
