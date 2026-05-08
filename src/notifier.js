import { sendAppointmentEmail } from "./email.js";
import { sendWebPush } from "./webpush.js";

export async function notifySubscribers(subscribers, result) {
  const title = result?.earliest
    ? "New earliest appointment available"
    : "Appointment check update";
  const body = result?.earliest
    ? `Hochtaunuskreis: ${result.earliest.label}`
    : "No Hochtaunuskreis appointment currently available.";

  await Promise.allSettled(
    subscribers.map(async (subscriber) => {
      await sendAppointmentEmail(subscriber.email, result);
      if (subscriber.pushSubscription) {
        await sendWebPush(subscriber.pushSubscription, {
          title,
          body,
          url: "/",
          checkedAt: result.checkedAt
        });
      }
    })
  );
}
