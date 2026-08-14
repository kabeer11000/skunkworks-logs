import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { startSync } from "@/services/sync";

type Status = "connecting" | "active" | "paused" | "error" | "offline";

const STATUS_META: Record<Status, { dot: string; label: string; description: string }> = {
	connecting: { dot: "bg-yellow-400", label: "connecting", description: "Establishing a connection to the sync server." },
	active: { dot: "bg-green-400", label: "synced", description: "Changes are syncing live with the server." },
	paused: { dot: "bg-yellow-400", label: "paused", description: "Up to date. Waiting for new changes to sync." },
	error: { dot: "bg-red-400", label: "error", description: "Sync ran into an error and may be retrying." },
	offline: { dot: "bg-neutral-300", label: "offline", description: "Couldn't reach the sync server. Your changes are saved locally." },
};

export default function SyncIndicator() {
	const [status, setStatus] = useState<Status>("connecting");
	const [lastChangedAt, setLastChangedAt] = useState<Date | null>(null);

	useEffect(() => {
		let timedOut = false;
		const timeout = setTimeout(() => {
			timedOut = true;
			setStatus("offline");
		}, 5000);

		startSync((s) => {
			if (timedOut) return;
			clearTimeout(timeout);
			setStatus(s as Status);
			setLastChangedAt(new Date());
		});

		return () => clearTimeout(timeout);
	}, []);

	const meta = STATUS_META[status];

	return (
		<Popover>
			<PopoverTrigger
				render={
					<button className="fixed top-4 right-6 z-50 flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm outline-none hover:bg-background focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
				}
			>
				<span className={`h-2 w-2 rounded-full ${meta.dot}`} />
				<span>{meta.label}</span>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-64 text-sm">
				<div className="flex items-center gap-2 font-medium">
					<span className={`h-2 w-2 rounded-full ${meta.dot}`} />
					<span className="capitalize">{meta.label}</span>
				</div>
				<p className="mt-1.5 text-xs text-muted-foreground">{meta.description}</p>
				{lastChangedAt && (
					<p className="mt-2 text-xs text-muted-foreground">
						Last update: {lastChangedAt.toLocaleTimeString()}
					</p>
				)}
			</PopoverContent>
		</Popover>
	);
}
