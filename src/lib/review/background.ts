import { prisma } from "../db";
import { runReview } from "./run";

// Runs a review after the upload has been answered, saving each stage so the
// review page can show progress, and a plain reason if it fails.
export async function runReviewInBackground(documentId: string, reviewId: string) {
  try {
    await runReview(documentId, {
      reviewId,
      onStage: (stage) => prisma.review.update({ where: { id: reviewId }, data: { stage } }),
    });
  } catch (err) {
    console.error(err);
    await prisma.review
      .update({
        where: { id: reviewId },
        data: { status: "FAILED", stage: "", error: "The checks could not finish on this contract. Try running them again; if it keeps failing, the file may be damaged." },
      })
      .catch(() => undefined);
  }
}
