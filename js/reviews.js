function createReview({ checkId, reviewer, comment = "" }) {
  const check = getCheck(checkId);
  if (!check) throw new Error("Controle bestaat niet.");

  if (!["passed", "failed"].includes(check.status)) {
    throw new Error("Een controle kan pas beoordeeld worden wanneer ze afgerond is.");
  }

  if (check.status === "failed") {
    throw new Error("Een mislukte controle kan niet worden goedgekeurd. Corrigeer de bron en voer een nieuwe controle uit.");
  }

  if (!reviewer || !reviewer.trim()) {
    throw new Error("Een reviewer is verplicht.");
  }

  const existing = getReviewForCheck(checkId);
  if (existing) throw new Error("Voor deze controle bestaat al een review.");

  const review = {
    id: crypto.randomUUID(),
    checkId,
    status: "pending",
    reviewer: reviewer.trim(),
    comment: comment.trim(),
    createdAt: new Date().toISOString()
  };

  state.reviews.push(review);
  saveState();
  return review;
}

function getReview(reviewId) {
  return state.reviews.find(review => review.id === reviewId);
}

function getReviewForCheck(checkId) {
  return state.reviews.find(review => review.checkId === checkId);
}

function updateReviewStatus({ reviewId, status, comment = "" }) {
  const review = getReview(reviewId);
  if (!review) throw new Error("Review bestaat niet.");

  if (review.status !== "pending") {
    throw new Error("Een afgeronde review kan niet meer worden gewijzigd.");
  }

  const allowed = ["pending", "approved", "rejected"];
  if (!allowed.includes(status)) throw new Error("Ongeldige reviewstatus.");

  review.status = status;
  review.comment = comment.trim();
  saveState();
  return review;
}
