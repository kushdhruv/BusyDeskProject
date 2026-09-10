import React from "react";
import { Status } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

interface StatusBadgeProps {
  status: Status;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  switch (status) {
    case "NEW":
      return (
        <Badge variant="info" size={size} dot>
          New
        </Badge>
      );
    case "OPEN":
      return (
        <Badge variant="info" size={size} dot>
          Open
        </Badge>
      );
    case "PENDING":
      return (
        <Badge variant="warning" size={size} dot>
          Pending Customer
        </Badge>
      );
    case "RESOLVED":
      return (
        <Badge variant="success" size={size} dot>
          Resolved
        </Badge>
      );
    case "CLOSED":
      return (
        <Badge variant="neutral" size={size} dot>
          Closed
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" size={size}>
          {status}
        </Badge>
      );
  }
}
