import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders Markdown (GFM: headings, bold, lists, tables, links) as styled HTML.
 * Used for AI interpretation text and assistant chat messages, which come back
 * from Claude as Markdown. Colors are pinned to the app's foreground/primary so
 * it reads correctly on both the page background and card surfaces.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none break-words",
        "text-foreground prose-headings:text-foreground prose-strong:text-foreground",
        "prose-a:text-primary prose-code:text-foreground",
        "prose-p:my-2 prose-headings:mt-3 prose-headings:mb-2",
        "prose-table:my-2 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
