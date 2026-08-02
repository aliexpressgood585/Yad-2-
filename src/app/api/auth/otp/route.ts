import { auth } from "@/lib/auth";
import { enforceRateLimit, handleError, ok, parseBody, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { consumeOtp, issueOtp } from "@/lib/otp";
import { otpSendSchema, otpVerifySchema } from "@/lib/validators";

/** שליחת קוד חד-פעמי ל-SMS. */
export async function POST(req: Request) {
  try {
    const { phone, purpose } = await parseBody(req, otpSendSchema);
    // מגבלה כפולה: לפי מספר הטלפון וגם לפי כתובת ה-IP
    await enforceRateLimit("otp", phone);
    await enforceRateLimit("otp");

    const result = await issueOtp(phone, purpose);
    return ok({ sent: true, devCode: result.devCode });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * אימות טלפון עבור משתמש מחובר (בשונה מהתחברות ב-OTP,
 * שמטופלת ע"י ספק ה-Credentials של Auth.js).
 */
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new ApiError(401, "יש להתחבר כדי לאמת מספר טלפון");
    }

    const { phone, code } = await parseBody(req, otpVerifySchema);
    await enforceRateLimit("otp", phone);

    const valid = await consumeOtp(phone, code, "verify");
    if (!valid) {
      throw new ApiError(400, "הקוד שגוי או פג תוקפו", "BAD_CODE");
    }

    const taken = await prisma.user.findFirst({
      where: { phone, NOT: { id: session.user.id } },
      select: { id: true },
    });
    if (taken) {
      throw new ApiError(409, "מספר הטלפון כבר משויך לחשבון אחר", "PHONE_TAKEN");
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { phone, verifiedAt: new Date() },
    });

    return ok({ verified: true, phone });
  } catch (err) {
    return handleError(err);
  }
}
