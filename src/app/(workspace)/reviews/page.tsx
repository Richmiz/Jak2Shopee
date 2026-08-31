import { ReviewsView } from "@/components/reviews/reviews-view";
import { listProducts } from "@/server/catalog-store.mts";

export default function ReviewsPage() {
  const reviews = listProducts().filter((product) => ["NEEDS_REVIEW", "FAILED", "BLOCKED", "DUPLICATE"].includes(product.status));
  return <ReviewsView products={reviews} />;
}
