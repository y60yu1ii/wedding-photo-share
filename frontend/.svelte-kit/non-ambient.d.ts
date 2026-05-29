
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/admin" | "/admin/event" | "/admin/event/[eventId]" | "/admin/event/[eventId]/design" | "/admin/login" | "/event" | "/event/[eventId]" | "/event/[eventId]/upload" | "/event/[eventId]/wall" | "/myguest" | "/myguest/[eventId]";
		RouteParams(): {
			"/admin/event/[eventId]": { eventId: string };
			"/admin/event/[eventId]/design": { eventId: string };
			"/event/[eventId]": { eventId: string };
			"/event/[eventId]/upload": { eventId: string };
			"/event/[eventId]/wall": { eventId: string };
			"/myguest/[eventId]": { eventId: string }
		};
		LayoutParams(): {
			"/": { eventId?: string | undefined };
			"/admin": { eventId?: string | undefined };
			"/admin/event": { eventId?: string | undefined };
			"/admin/event/[eventId]": { eventId: string };
			"/admin/event/[eventId]/design": { eventId: string };
			"/admin/login": Record<string, never>;
			"/event": { eventId?: string | undefined };
			"/event/[eventId]": { eventId: string };
			"/event/[eventId]/upload": { eventId: string };
			"/event/[eventId]/wall": { eventId: string };
			"/myguest": { eventId?: string | undefined };
			"/myguest/[eventId]": { eventId: string }
		};
		Pathname(): "/" | "/admin" | `/admin/event/${string}` & {} | `/admin/event/${string}/design` & {} | "/admin/login" | `/event/${string}` & {} | `/event/${string}/upload` & {} | `/event/${string}/wall` & {} | `/myguest/${string}` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}