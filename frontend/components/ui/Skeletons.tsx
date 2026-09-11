"use client";

import React from "react";

export function DashboardSkeleton() {
  return (
    <div className="space-y-5 pb-12 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1.5">
          <div className="h-5 w-44 bg-slate-200 rounded" />
          <div className="h-3.5 w-72 bg-slate-100 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-slate-100 rounded-md" />
          <div className="h-8 w-28 bg-slate-200 rounded-md" />
        </div>
      </div>

      {/* 4 Headline Metrics Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-4 rounded-md border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-slate-100 rounded" />
              <div className="h-4 w-4 bg-slate-100 rounded-full" />
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <div className="h-7 w-12 bg-slate-200 rounded" />
              <div className="h-4 w-14 bg-slate-100 rounded" />
            </div>
            <div className="h-2.5 w-32 bg-slate-50 rounded" />
          </div>
        ))}
      </div>

      {/* CSAT Card Skeleton */}
      <div className="bg-white rounded-md p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1.5 w-full md:w-1/2">
          <div className="h-3 w-36 bg-slate-200 rounded" />
          <div className="h-3 w-64 bg-slate-100 rounded" />
        </div>
        <div className="h-8 w-48 bg-slate-100 rounded" />
      </div>

      {/* Mid Row Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6 bg-white p-4 rounded-md border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <div className="h-3.5 w-28 bg-slate-200 rounded" />
            <div className="h-3.5 w-14 bg-slate-100 rounded" />
          </div>
          <div className="flex items-center gap-6 py-4">
            <div className="w-32 h-32 rounded-full border-8 border-slate-100 bg-transparent" />
            <div className="flex-1 space-y-2.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="flex justify-between">
                  <div className="h-3 w-20 bg-slate-100 rounded" />
                  <div className="h-3 w-8 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white p-4 rounded-md border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <div className="h-3.5 w-28 bg-slate-200 rounded" />
            <div className="h-3.5 w-20 bg-slate-100 rounded" />
          </div>
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((a) => (
              <div key={a} className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-3 w-32 bg-slate-200 rounded" />
                  <div className="h-3 w-6 bg-slate-100 rounded" />
                </div>
                <div className="h-2 w-full bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function QueueTableSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {/* Controls Bar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 rounded-md border border-slate-200 shadow-xs">
        <div className="h-8 w-56 bg-slate-100 rounded" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-slate-100 rounded" />
          <div className="h-8 w-24 bg-slate-100 rounded" />
          <div className="h-8 w-28 bg-slate-200 rounded" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-md border border-slate-200 shadow-xs overflow-hidden">
        <div className="h-10 bg-slate-50 border-b border-slate-200 px-4 flex items-center justify-between">
          <div className="h-3 w-20 bg-slate-200 rounded" />
          <div className="h-3 w-32 bg-slate-200 rounded" />
          <div className="h-3 w-16 bg-slate-200 rounded" />
          <div className="h-3 w-20 bg-slate-200 rounded" />
          <div className="h-3 w-24 bg-slate-200 rounded" />
        </div>
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
            <div key={row} className="px-4 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-1/3">
                <div className="w-4 h-4 bg-slate-100 rounded" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-3/4 bg-slate-200 rounded" />
                  <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-5 w-16 bg-slate-100 rounded-full" />
              <div className="h-5 w-14 bg-slate-100 rounded-full" />
              <div className="h-5 w-20 bg-slate-100 rounded-full" />
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TicketWorkspaceSkeleton() {
  return (
    <div className="space-y-4 animate-pulse pb-12">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 bg-slate-100 rounded" />
          <div className="h-5 w-16 bg-slate-200 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-slate-100 rounded" />
          <div className="h-8 w-28 bg-slate-200 rounded" />
        </div>
      </div>

      {/* Ticket Title & SLA Banner */}
      <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-6 w-1/2 bg-slate-200 rounded" />
          <div className="h-6 w-28 bg-slate-100 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-20 bg-slate-100 rounded-full" />
          <div className="h-4 w-20 bg-slate-100 rounded-full" />
          <div className="h-4 w-32 bg-slate-100 rounded" />
        </div>
      </div>

      {/* Timeline Messages Skeleton */}
      <div className="space-y-3 pt-2">
        <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between">
            <div className="h-3.5 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="h-3 w-full bg-slate-100 rounded" />
            <div className="h-3 w-4/5 bg-slate-100 rounded" />
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-md border border-slate-200 shadow-xs space-y-2 ml-8">
          <div className="flex justify-between">
            <div className="h-3.5 w-32 bg-slate-300 rounded" />
            <div className="h-3 w-20 bg-slate-200 rounded" />
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="h-3 w-full bg-slate-200 rounded" />
            <div className="h-3 w-2/3 bg-slate-200 rounded" />
          </div>
        </div>
      </div>

      {/* Composer Skeleton */}
      <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs space-y-3">
        <div className="h-20 w-full bg-slate-50 rounded border border-slate-100" />
        <div className="flex justify-between items-center">
          <div className="h-7 w-24 bg-slate-100 rounded" />
          <div className="h-8 w-28 bg-slate-200 rounded" />
        </div>
      </div>
    </div>
  );
}

export function CustomerDashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="bg-white rounded-md p-5 border border-slate-200 shadow-xs space-y-2">
        <div className="h-3 w-28 bg-slate-200 rounded" />
        <div className="h-6 w-48 bg-slate-300 rounded" />
        <div className="h-3 w-72 bg-slate-100 rounded" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-md p-4 border border-slate-200 shadow-xs space-y-2">
            <div className="h-3 w-24 bg-slate-100 rounded" />
            <div className="h-6 w-12 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
