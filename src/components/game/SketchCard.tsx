import * as React from "react";
import { cn } from "@/lib/utils";

interface SketchCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "accent" | "secondary" | "muted";
}

const SketchCard = React.forwardRef<HTMLDivElement, SketchCardProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantStyles = {
      default: "bg-card",
      accent: "bg-accent",
      secondary: "bg-secondary/30",
      muted: "bg-muted",
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border-3 border-foreground shadow-sketch-lg p-6",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);
SketchCard.displayName = "SketchCard";

const SketchCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
));
SketchCardHeader.displayName = "SketchCardHeader";

const SketchCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-handwritten leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
SketchCardTitle.displayName = "SketchCardTitle";

const SketchCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));
SketchCardContent.displayName = "SketchCardContent";

export { SketchCard, SketchCardHeader, SketchCardTitle, SketchCardContent };
