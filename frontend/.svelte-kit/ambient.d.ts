
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const VITE_API_URL: string;
	export const VITE_WS_URL: string;
	export const NVM_INC: string;
	export const GREP_COLOR: string;
	export const CODEX_SANDBOX_NETWORK_DISABLED: string;
	export const LESS_TERMCAP_mb: string;
	export const NODE: string;
	export const MINIMAX_API_KEY: string;
	export const LESS_TERMCAP_md: string;
	export const INIT_CWD: string;
	export const _P9K_TTY: string;
	export const NVM_CD_FLAGS: string;
	export const LESS_TERMCAP_me: string;
	export const ANDROID_HOME: string;
	export const TERM: string;
	export const SHELL: string;
	export const TMPDIR: string;
	export const SSH_CLIENT: string;
	export const npm_config_global_prefix: string;
	export const CODEX_MANAGED_PACKAGE_ROOT: string;
	export const COLOR: string;
	export const NO_COLOR: string;
	export const LESS_TERMCAP_ue: string;
	export const npm_config_noproxy: string;
	export const SSH_TTY: string;
	export const npm_config_local_prefix: string;
	export const LC_ALL: string;
	export const USER: string;
	export const NVM_DIR: string;
	export const GREP_COLORS: string;
	export const npm_config_globalconfig: string;
	export const mount_authenticator_shm: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const npm_execpath: string;
	export const PAGER: string;
	export const LSCOLORS: string;
	export const LESS_TERMCAP_us: string;
	export const PATH: string;
	export const npm_package_json: string;
	export const _: string;
	export const npm_config_userconfig: string;
	export const npm_config_init_module: string;
	export const CODEX_THREAD_ID: string;
	export const npm_command: string;
	export const PWD: string;
	export const npm_lifecycle_event: string;
	export const P9K_SSH: string;
	export const EDITOR: string;
	export const npm_package_name: string;
	export const P9K_TTY: string;
	export const LANG: string;
	export const npm_config_npm_version: string;
	export const CODEX_MANAGED_BY_NPM: string;
	export const CODEX_CI: string;
	export const npm_config_node_gyp: string;
	export const npm_package_version: string;
	export const SHLVL: string;
	export const HOME: string;
	export const GH_PAGER: string;
	export const npm_config_cache: string;
	export const LOGNAME: string;
	export const LESS: string;
	export const npm_lifecycle_script: string;
	export const VISUAL: string;
	export const SSH_CONNECTION: string;
	export const LESS_TERMCAP_so: string;
	export const LC_CTYPE: string;
	export const NVM_BIN: string;
	export const BUN_INSTALL: string;
	export const npm_config_user_agent: string;
	export const BROWSER: string;
	export const _P9K_SSH_TTY: string;
	export const GIT_PAGER: string;
	export const npm_node_execpath: string;
	export const npm_config_prefix: string;
	export const LESS_TERMCAP_se: string;
	export const COLORTERM: string;
	export const NODE_ENV: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		VITE_API_URL: string;
		VITE_WS_URL: string;
		NVM_INC: string;
		GREP_COLOR: string;
		CODEX_SANDBOX_NETWORK_DISABLED: string;
		LESS_TERMCAP_mb: string;
		NODE: string;
		MINIMAX_API_KEY: string;
		LESS_TERMCAP_md: string;
		INIT_CWD: string;
		_P9K_TTY: string;
		NVM_CD_FLAGS: string;
		LESS_TERMCAP_me: string;
		ANDROID_HOME: string;
		TERM: string;
		SHELL: string;
		TMPDIR: string;
		SSH_CLIENT: string;
		npm_config_global_prefix: string;
		CODEX_MANAGED_PACKAGE_ROOT: string;
		COLOR: string;
		NO_COLOR: string;
		LESS_TERMCAP_ue: string;
		npm_config_noproxy: string;
		SSH_TTY: string;
		npm_config_local_prefix: string;
		LC_ALL: string;
		USER: string;
		NVM_DIR: string;
		GREP_COLORS: string;
		npm_config_globalconfig: string;
		mount_authenticator_shm: string;
		__CF_USER_TEXT_ENCODING: string;
		npm_execpath: string;
		PAGER: string;
		LSCOLORS: string;
		LESS_TERMCAP_us: string;
		PATH: string;
		npm_package_json: string;
		_: string;
		npm_config_userconfig: string;
		npm_config_init_module: string;
		CODEX_THREAD_ID: string;
		npm_command: string;
		PWD: string;
		npm_lifecycle_event: string;
		P9K_SSH: string;
		EDITOR: string;
		npm_package_name: string;
		P9K_TTY: string;
		LANG: string;
		npm_config_npm_version: string;
		CODEX_MANAGED_BY_NPM: string;
		CODEX_CI: string;
		npm_config_node_gyp: string;
		npm_package_version: string;
		SHLVL: string;
		HOME: string;
		GH_PAGER: string;
		npm_config_cache: string;
		LOGNAME: string;
		LESS: string;
		npm_lifecycle_script: string;
		VISUAL: string;
		SSH_CONNECTION: string;
		LESS_TERMCAP_so: string;
		LC_CTYPE: string;
		NVM_BIN: string;
		BUN_INSTALL: string;
		npm_config_user_agent: string;
		BROWSER: string;
		_P9K_SSH_TTY: string;
		GIT_PAGER: string;
		npm_node_execpath: string;
		npm_config_prefix: string;
		LESS_TERMCAP_se: string;
		COLORTERM: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
