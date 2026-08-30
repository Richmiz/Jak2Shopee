import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductAvatar({ accent, className }: { accent: string; className?: string }) {
  return (
    <div className={cn("grid size-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br", accent, className)}>
      <Package className="size-5" aria-hidden="true" />
    </div>
  );
}
