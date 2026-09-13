"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Priority, Category, User as SessionUser } from "@/lib/types";
import { ApiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { CategoryBadge } from "@/components/PriorityBadge";
import { formatFileSize } from "@/components/ui/AttachmentView";
import {
  ArrowLeft,
  AlertCircle,
  Bug,
  CreditCard,
  Sparkles,
  HelpCircle,
  UserCheck,
  Layers,
  Zap,
  ShieldAlert,
  GraduationCap,
  FileQuestion,
  UploadCloud,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Paperclip,
  X,
  FileText,
  Check,
  Headphones,
  Info,
} from "lucide-react";

interface CategoryDefinition {
  id: Category;
  label: string;
  shortLabel: string;
  description: string;
  placeholder: string;
  icon: React.ElementType;
}

const CATEGORIES: CategoryDefinition[] = [
  {
    id: "QUESTION",
    label: "Question & Accounting Help",
    shortLabel: "Question",
    description: "How-to guidance, GST rules, or feature navigation.",
    placeholder: "Explain what you want to accomplish in BUSY and where you need assistance...",
    icon: HelpCircle,
  },
  {
    id: "BUG",
    label: "Bug & Defect",
    shortLabel: "Bug",
    description: "Unexpected behavior, calculation glitch, or system freeze.",
    placeholder: "1. Steps to reproduce\n2. Expected behavior\n3. What actually occurred\n4. Error message (if any)...",
    icon: Bug,
  },
  {
    id: "BILLING",
    label: "Billing & Licensing",
    shortLabel: "Billing",
    description: "Subscription renewal, tax invoices, or dongle license key.",
    placeholder: "Include your License/Dongle number, invoice details, and the billing inquiry...",
    icon: CreditCard,
  },
  {
    id: "FEATURE",
    label: "Feature Request",
    shortLabel: "Feature",
    description: "Ideas for new accounting reports, tax forms, or shortcuts.",
    placeholder: "Describe the new capability you'd like to see and why it helps your daily operations...",
    icon: Sparkles,
  },
  {
    id: "INTEGRATION",
    label: "GST & Bank Integration",
    shortLabel: "Integration",
    description: "E-Way bill portal, E-invoicing, bank reconciliation API.",
    placeholder: "Specify the external portal (e.g. NIC Portal, ICICI Bank) and what failed...",
    icon: Layers,
  },
  {
    id: "ACCOUNT",
    label: "User Access & Security",
    shortLabel: "Account",
    description: "Sub-user rights, role permissions, or password reset.",
    placeholder: "Specify which operator account is affected and the permissions needed...",
    icon: UserCheck,
  },
  {
    id: "PERFORMANCE",
    label: "Performance & Slowness",
    shortLabel: "Speed",
    description: "Slow ledger generation, backup delays, or high RAM usage.",
    placeholder: "Detail which screen is slow, data volume (e.g. 50k vouchers), and average delay...",
    icon: Zap,
  },
  {
    id: "SECURITY",
    label: "Security & Data Integrity",
    shortLabel: "Security",
    description: "Database verification, data restore, or audit trail inquiry.",
    placeholder: "Describe any data anomaly, check-sum alert, or security concern...",
    icon: ShieldAlert,
  },
  {
    id: "ONBOARDING",
    label: "Onboarding & Migration",
    shortLabel: "Onboarding",
    description: "Data import from Excel/Tally, initial company creation.",
    placeholder: "Let us know the legacy software format and number of companies to import...",
    icon: GraduationCap,
  },
  {
    id: "OTHER",
    label: "Other Inquiry",
    shortLabel: "Other",
    description: "General operational requests not covered above.",
    placeholder: "Provide complete details about your request or inquiry...",
    icon: FileQuestion,
  },
];

function NewTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramCategory = (searchParams.get("category") as Category) || null;
  const paramUrgency = (searchParams.get("urgency") as "LOW" | "NORMAL" | "HIGH") || null;
  const paramPriority = (searchParams.get("priority") as Priority) || null;
  const paramSubject = searchParams.get("subject") || "";

  const [user, setUser] = useState<SessionUser | null>(null);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [subject, setSubject] = useState(paramSubject);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>(paramCategory || "QUESTION");
  const [customerUrgency, setCustomerUrgency] = useState<"LOW" | "NORMAL" | "HIGH">(paramUrgency || "NORMAL");
  const [priority, setPriority] = useState<Priority>(paramPriority || "MEDIUM");

  // Staff Fields
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");

  // File Attachment State
  const [attachedFile, setAttachedFile] = useState<{
    url: string;
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((d) => {
        setUser(d.user);
        if (d.user && d.user.role === "AGENT") {
          setAssigneeId(d.user.id);
        }
      });

    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((d) => setAgents(d.users || []));
  }, []);

  const isCustomer = user?.role === "CUSTOMER";
  const activeCategoryDef = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];

  // Upload handler
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit. Please choose a smaller file.");
      return;
    }

    setUploadingAttachment(true);
    try {
      const uploaded = await ApiClient.uploadFile(file);
      setAttachedFile(uploaded);
    } catch (err: any) {
      alert(err.message || "Failed to upload file.");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError("Please enter a ticket subject.");
      return;
    }
    if (!description.trim()) {
      setError("Please describe your issue or question.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        subject: subject.trim(),
        description: description.trim(),
        category,
      };

      if (attachedFile) {
        payload.attachmentUrl = attachedFile.url;
        payload.attachmentName = attachedFile.name;
        payload.attachmentSize = attachedFile.size;
        payload.attachmentType = attachedFile.type;
      }

      if (isCustomer) {
        payload.customerUrgency = customerUrgency;
      } else {
        payload.requesterName = requesterName.trim();
        payload.requesterEmail = requesterEmail.trim();
        payload.priority = priority;
        payload.primaryAssigneeId = assigneeId || undefined;
      }

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create ticket.");
      }

      const { ticket } = await res.json();
      router.push(`/tickets/${ticket.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create ticket.");
    } finally {
      setLoading(false);
    }
  };

  // Response SLA estimated string
  const getEstimatedSla = () => {
    if (isCustomer) {
      if (customerUrgency === "HIGH") return { time: "< 8 Hours", label: "Priority Queue (High Urgency)" };
      if (customerUrgency === "LOW") return { time: "< 72 Hours", label: "Standard Queue (General Inquiry)" };
      return { time: "< 24 Hours", label: "Standard Business Queue" };
    }
    if (priority === "URGENT") return { time: "< 2 Hours", label: "Urgent P1 Target" };
    if (priority === "HIGH") return { time: "< 8 Hours", label: "High P2 Target" };
    if (priority === "LOW") return { time: "< 72 Hours", label: "Low P4 Target" };
    return { time: "< 24 Hours", label: "Medium P3 Target" };
  };

  const slaInfo = getEstimatedSla();

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-20">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="xs"
            onClick={() => router.push(isCustomer ? "/dashboard" : "/tickets")}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
            aria-label="Back"
          />
          <div>
            <h1 className="text-base font-semibold text-slate-900 tracking-tight">
              {isCustomer ? "Submit a Support Request" : "Create New Support Ticket"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isCustomer
                ? "Describe your inquiry and our support team will assist you within SLA targets."
                : "Record an inbound support inquiry with designated priority and category."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-md shadow-xs">
          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>SLA Target: <strong className="text-slate-900">{slaInfo.time}</strong></span>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md font-medium flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Content: Left 8 Columns */}
          <div className="lg:col-span-8 space-y-5">
            {/* Category Selection Grid */}
            <div className="bg-white rounded-md border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <span>Category</span>
                    <span className="text-rose-500">*</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select the domain that best describes the request.
                  </p>
                </div>
                <CategoryBadge category={category} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`relative flex flex-col items-start p-2.5 rounded-md border text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center ${
                            isSelected ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                      </div>
                      <span
                        className={`text-xs font-medium leading-tight truncate w-full ${
                          isSelected ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {cat.shortLabel}
                      </span>
                      <span
                        className={`text-[10px] line-clamp-2 mt-0.5 leading-snug ${
                          isSelected ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {cat.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Issue Details & Summary */}
            <div className="bg-white rounded-md border border-slate-200 p-4 shadow-xs space-y-4">
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Issue Details
              </h2>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Subject / Summary <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. GST E-Way Bill JSON generation failed with error 400"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Detailed Description <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {description.length} characters
                  </span>
                </div>
                <Textarea
                  rows={7}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={activeCategoryDef.placeholder}
                  required
                  className="font-mono text-xs leading-relaxed"
                />
              </div>
            </div>

            {/* File Attachment Dropzone */}
            <div className="bg-white rounded-md border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <span>Attachments</span>
                    <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Attach screenshots, log files, exported reports, or receipts.
                  </p>
                </div>
                <Paperclip className="w-4 h-4 text-slate-400" />
              </div>

              {attachedFile ? (
                /* Uploaded File Chip */
                <div className="p-3 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate min-w-0">
                      <div className="text-xs font-medium text-slate-900 truncate">
                        {attachedFile.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {formatFileSize(attachedFile.size)} · Ready to submit
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* Drag and Drop Zone */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed rounded-md p-5 text-center transition-colors cursor-pointer ${
                    isDragOver
                      ? "border-slate-900 bg-slate-100/70"
                      : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                    accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.zip,.log"
                  />

                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 mb-1 shadow-xs">
                      {uploadingAttachment ? (
                        <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <UploadCloud className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-800">
                      {uploadingAttachment ? (
                        "Uploading attachment..."
                      ) : (
                        <>
                          <span className="font-semibold text-slate-900 underline">Click to upload</span> or drag and drop
                        </>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      PNG, JPG, PDF, TXT, CSV, LOG, ZIP up to 10MB
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Preview & Properties (4 Columns) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Properties Card */}
            <div className="bg-white rounded-md border border-slate-200 p-4 shadow-xs space-y-4">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                Routing & Priority
              </h3>

              {/* Customer Urgency Selector */}
              {isCustomer ? (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Business Urgency
                  </label>
                  <div className="space-y-1.5">
                    {[
                      {
                        val: "LOW",
                        label: "Low Urgency",
                        sub: "General question · 72h SLA",
                        color: "border-slate-200 hover:bg-slate-50 text-slate-800",
                        selected: "border-slate-900 bg-slate-900 text-white shadow-xs",
                      },
                      {
                        val: "NORMAL",
                        label: "Normal Urgency",
                        sub: "Standard issue · 24h SLA",
                        color: "border-slate-200 hover:bg-slate-50 text-slate-800",
                        selected: "border-slate-900 bg-slate-900 text-white shadow-xs",
                      },
                      {
                        val: "HIGH",
                        label: "High Urgency",
                        sub: "Blocking daily work · 8h SLA",
                        color: "border-slate-200 hover:bg-slate-50 text-slate-800",
                        selected: "border-rose-600 bg-rose-600 text-white shadow-xs",
                      },
                    ].map((item) => {
                      const isChecked = customerUrgency === item.val;
                      return (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setCustomerUrgency(item.val as any)}
                          className={`w-full text-left p-2.5 rounded-md border text-xs transition cursor-pointer flex items-center justify-between ${
                            isChecked ? item.selected : item.color
                          }`}
                        >
                          <div>
                            <div className="font-semibold leading-tight">{item.label}</div>
                            <div className={`text-[10px] mt-0.5 ${isChecked ? "text-slate-200" : "text-slate-500"}`}>{item.sub}</div>
                          </div>
                          {isChecked && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Staff Requester Fields */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Requester Name <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                      placeholder="e.g. Ramesh Sharma"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Requester Email <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="email"
                      value={requesterEmail}
                      onChange={(e) => setRequesterEmail(e.target.value)}
                      placeholder="ramesh@company.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Priority Target
                    </label>
                    <Select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as Priority)}
                      className="w-full"
                    >
                      <option value="URGENT">Urgent (2h SLA)</option>
                      <option value="HIGH">High (8h SLA)</option>
                      <option value="MEDIUM">Medium (24h SLA)</option>
                      <option value="LOW">Low (72h SLA)</option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Primary Assignee
                    </label>
                    <Select
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="w-full"
                    >
                      <option value="">Unassigned (Round-Robin)</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={loading}
                  className="w-full justify-center shadow-xs"
                >
                  {isCustomer ? "Submit Support Request" : "Create Ticket"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => router.push(isCustomer ? "/dashboard" : "/tickets")}
                >
                  Cancel
                </Button>
              </div>
            </div>

            {/* Ticket Preview Card */}
            <div className="bg-white rounded-md border border-slate-200 p-4 shadow-xs space-y-3">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Live Request Summary
              </h3>

              <div className="p-3 bg-slate-50/60 rounded-md border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <CategoryBadge category={category} />
                  <span className="text-[10px] font-mono text-slate-400">#NEW</span>
                </div>
                <div className="font-semibold text-slate-900 truncate">
                  {subject.trim() || "Untitled inquiry..."}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed">
                  {description.trim() || "No description provided yet..."}
                </p>
                {attachedFile && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
                    <Paperclip className="w-3 h-3 text-slate-500" />
                    <span className="truncate">{attachedFile.name}</span>
                  </div>
                )}
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Response Target:</span>
                <span className="font-semibold text-slate-900">{slaInfo.time}</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewTicketPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto p-8 flex items-center justify-center text-sm text-slate-500">
          Loading ticket intake form...
        </div>
      }
    >
      <NewTicketForm />
    </Suspense>
  );
}

