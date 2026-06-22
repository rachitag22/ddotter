"use client";

import { useEffect, useRef, useState } from "react";
import { facilityTypeColor, facilityTypeLabel } from "@/lib/design";
import type { FacilityType } from "@/lib/types";

type FacilityEntry = {
  key: FacilityType;
  description: string;
  children?: { key: FacilityType; description: string }[];
};

const FACILITY_TYPES: FacilityEntry[] = [
  {
    key: "protected",
    description: "Physically separated from traffic by a barrier, bollards, or raised curb.",
    children: [
      { key: "dual_protected", description: "Protected on both sides of the lane." },
    ],
  },
  {
    key: "buffered",
    description: "Painted buffer zone between the bike lane and traffic or parking — no physical barrier.",
    children: [
      { key: "dual_buffered", description: "Buffer on both sides of the lane." },
    ],
  },
  { key: "conventional", description: "Standard painted bike lane — no buffer or protection." },
  { key: "contraflow",   description: "Bike lane running opposite to vehicle traffic on a one-way street." },
  { key: "sharrow",      description: "Shared lane: no dedicated lane, just road markings (chevrons) showing bikes share the road." },
  { key: "shared_path",  description: "Multi-use path shared with pedestrians, off the roadway." },
  { key: "trail",        description: "Off-road trail or greenway." },
];

function FacilityRow({
  type,
  isChild = false,
}: {
  type: { key: FacilityType; description: string };
  isChild?: boolean;
}) {
  return (
    <div className={`facility-type-row${isChild ? " child" : ""}`}>
      {/* placeholder icon slot — swap for <img src="…" /> when icons are ready */}
      <span aria-hidden="true" className="facility-type-icon" style={{ background: facilityTypeColor[type.key] }} />
      <div className="facility-type-text">
        <span className="facility-type-label">{facilityTypeLabel[type.key]}</span>
        <span className="facility-type-desc">{type.description}</span>
      </div>
    </div>
  );
}

export function FacilityTypeInfo() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  return (
    <>
      <button
        aria-label="Bike lane type guide"
        className="info-btn"
        onClick={() => setOpen(true)}
        type="button"
      >
        ⓘ
      </button>

      <dialog className="facility-dialog" ref={dialogRef}>
        <div className="facility-dialog-header">
          <h2>Bike lane types</h2>
          <button
            aria-label="Close"
            className="facility-dialog-close"
            onClick={() => setOpen(false)}
            type="button"
          >
            ✕
          </button>
        </div>
        <div className="facility-dialog-body">
          {FACILITY_TYPES.map((entry) => (
            <div key={entry.key}>
              <FacilityRow type={entry} />
              {entry.children?.map((child) => (
                <FacilityRow key={child.key} type={child} isChild />
              ))}
            </div>
          ))}
        </div>
      </dialog>
    </>
  );
}
