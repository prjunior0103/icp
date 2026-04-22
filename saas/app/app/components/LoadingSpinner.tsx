"use client";

import { Loader2 } from "lucide-react";

interface Props {
  size?: number;
  text?: string;
}

export function LoadingSpinner({ size = 24, text }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 py-8">
      <Loader2 size={size} className="animate-spin text-blue-600" />
      {text && <span className="text-sm text-gray-500">{text}</span>}
    </div>
  );
}
