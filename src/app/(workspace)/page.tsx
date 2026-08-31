import { DashboardView } from "@/components/dashboard/dashboard-view";
import { isWorkerOnline, listJobs, listProducts } from "@/server/catalog-store.mts";

export default function DashboardPage() {
  return <DashboardView products={listProducts()} jobs={listJobs()} workerOnline={isWorkerOnline()} />;
}
