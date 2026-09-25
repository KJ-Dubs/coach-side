import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BubbleButton } from "@/components/Bubbles";

export function BackNav({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to}>
      <BubbleButton size="sm" tone="ghost" aria-label={`Back to ${label}`}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {label}
      </BubbleButton>
    </Link>
  );
}