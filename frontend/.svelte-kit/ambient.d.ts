
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
	export const HERMES_HOME: string;
	export const HERMES_SESSION_CHAT_ID: string;
	export const HERMES_SESSION_MESSAGE_ID: string;
	export const timezone: string;
	export const TERMINAL_PERSISTENT_SHELL: string;
	export const TERMINAL_DOCKER_ENV: string;
	export const HERMES_SESSION_USER_NAME: string;
	export const TERMINAL_CONTAINER_CPU: string;
	export const NODE: string;
	export const SSL_CERT_FILE: string;
	export const TELEGRAM_ALLOWED_CHATS: string;
	export const HERMES_GATEWAY_BUSY_INPUT_MODE: string;
	export const HERMES_AGENT_NOTIFY_INTERVAL: string;
	export const INIT_CWD: string;
	export const BROWSER_INACTIVITY_TIMEOUT: string;
	export const _HERMES_GATEWAY: string;
	export const DISCORD_HISTORY_BACKFILL: string;
	export const SHELL: string;
	export const TERMINAL_LIFETIME_SECONDS: string;
	export const HERMES_MAX_ITERATIONS: string;
	export const TMPDIR: string;
	export const npm_config_global_prefix: string;
	export const HERMES_RESTART_DRAIN_TIMEOUT: string;
	export const CONDA_SHLVL: string;
	export const CONDA_PROMPT_MODIFIER: string;
	export const TERMINAL_DOCKER_VOLUMES: string;
	export const HERMES_QUIET: string;
	export const GVM_ROOT: string;
	export const VISION_TOOLS_DEBUG: string;
	export const DISCORD_ALLOWED_CHANNELS: string;
	export const TERMINAL_ENV: string;
	export const COLOR: string;
	export const MOA_TOOLS_DEBUG: string;
	export const npm_config_noproxy: string;
	export const npm_config_local_prefix: string;
	export const HERMES_SESSION_KEY: string;
	export const TERMINAL_CONTAINER_PERSISTENT: string;
	export const USER: string;
	export const _CONDA_EXE: string;
	export const WEB_TOOLS_DEBUG: string;
	export const npm_config_globalconfig: string;
	export const CONDA_EXE: string;
	export const SSH_AUTH_SOCK: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const IMAGE_TOOLS_DEBUG: string;
	export const MATRIX_ALLOWED_ROOMS: string;
	export const npm_execpath: string;
	export const file_read_max_chars: string;
	export const VIRTUAL_ENV: string;
	export const TERMINAL_SINGULARITY_IMAGE: string;
	export const SLACK_REQUIRE_MENTION: string;
	export const _CE_CONDA: string;
	export const SLACK_ALLOWED_CHANNELS: string;
	export const PATH: string;
	export const HERMES_AGENT_TIMEOUT_WARNING: string;
	export const npm_package_json: string;
	export const _: string;
	export const npm_config_userconfig: string;
	export const npm_config_init_module: string;
	export const BROWSERBASE_ADVANCED_STEALTH: string;
	export const HERMES_REDACT_SECRETS: string;
	export const CONDA_PREFIX: string;
	export const npm_command: string;
	export const hooks_auto_accept: string;
	export const TERMINAL_DAYTONA_IMAGE: string;
	export const PWD: string;
	export const GVM_VERSION: string;
	export const HERMES_SESSION_CHAT_NAME: string;
	export const npm_lifecycle_event: string;
	export const EDITOR: string;
	export const npm_package_name: string;
	export const TERMINAL_DOCKER_MOUNT_CWD_TO_WORKSPACE: string;
	export const _config_version: string;
	export const prefill_messages_file: string;
	export const HERMES_SESSION_USER_ID: string;
	export const DISCORD_HISTORY_BACKFILL_LIMIT: string;
	export const npm_config_npm_version: string;
	export const HERMES_SESSION_PLATFORM: string;
	export const XPC_FLAGS: string;
	export const TERMINAL_MODAL_IMAGE: string;
	export const TERMINAL_TIMEOUT: string;
	export const TERMINAL_DOCKER_IMAGE: string;
	export const npm_config_node_gyp: string;
	export const TERMINAL_CONTAINER_MEMORY: string;
	export const npm_package_version: string;
	export const TERMINAL_CWD: string;
	export const XPC_SERVICE_NAME: string;
	export const _CONDA_ROOT: string;
	export const TERMINAL_VERCEL_RUNTIME: string;
	export const _CE_M: string;
	export const TELEGRAM_REACTIONS: string;
	export const SHLVL: string;
	export const HOME: string;
	export const HERMES_AGENT_TIMEOUT: string;
	export const DISCORD_REACTIONS: string;
	export const npm_config_cache: string;
	export const CONDA_PYTHON_EXE: string;
	export const LOGNAME: string;
	export const npm_lifecycle_script: string;
	export const SLACK_FREE_RESPONSE_CHANNELS: string;
	export const LC_CTYPE: string;
	export const BROWSERBASE_PROXIES: string;
	export const CONDA_DEFAULT_ENV: string;
	export const npm_config_user_agent: string;
	export const DISCORD_THREAD_REQUIRE_MENTION: string;
	export const TERMINAL_DOCKER_RUN_AS_HOST_USER: string;
	export const HERMES_SESSION_ID: string;
	export const BROWSER_SESSION_TIMEOUT: string;
	export const TERMINAL_DOCKER_FORWARD_ENV: string;
	export const DISPLAY: string;
	export const OSLogRateLimit: string;
	export const HERMES_AUTO_CONTINUE_FRESHNESS: string;
	export const TERMINAL_CONTAINER_DISK: string;
	export const HERMES_EXEC_ASK: string;
	export const npm_node_execpath: string;
	export const npm_config_prefix: string;
	export const group_sessions_per_user: string;
	export const GVM_PATH_BACKUP: string;
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
		HERMES_HOME: string;
		HERMES_SESSION_CHAT_ID: string;
		HERMES_SESSION_MESSAGE_ID: string;
		timezone: string;
		TERMINAL_PERSISTENT_SHELL: string;
		TERMINAL_DOCKER_ENV: string;
		HERMES_SESSION_USER_NAME: string;
		TERMINAL_CONTAINER_CPU: string;
		NODE: string;
		SSL_CERT_FILE: string;
		TELEGRAM_ALLOWED_CHATS: string;
		HERMES_GATEWAY_BUSY_INPUT_MODE: string;
		HERMES_AGENT_NOTIFY_INTERVAL: string;
		INIT_CWD: string;
		BROWSER_INACTIVITY_TIMEOUT: string;
		_HERMES_GATEWAY: string;
		DISCORD_HISTORY_BACKFILL: string;
		SHELL: string;
		TERMINAL_LIFETIME_SECONDS: string;
		HERMES_MAX_ITERATIONS: string;
		TMPDIR: string;
		npm_config_global_prefix: string;
		HERMES_RESTART_DRAIN_TIMEOUT: string;
		CONDA_SHLVL: string;
		CONDA_PROMPT_MODIFIER: string;
		TERMINAL_DOCKER_VOLUMES: string;
		HERMES_QUIET: string;
		GVM_ROOT: string;
		VISION_TOOLS_DEBUG: string;
		DISCORD_ALLOWED_CHANNELS: string;
		TERMINAL_ENV: string;
		COLOR: string;
		MOA_TOOLS_DEBUG: string;
		npm_config_noproxy: string;
		npm_config_local_prefix: string;
		HERMES_SESSION_KEY: string;
		TERMINAL_CONTAINER_PERSISTENT: string;
		USER: string;
		_CONDA_EXE: string;
		WEB_TOOLS_DEBUG: string;
		npm_config_globalconfig: string;
		CONDA_EXE: string;
		SSH_AUTH_SOCK: string;
		__CF_USER_TEXT_ENCODING: string;
		IMAGE_TOOLS_DEBUG: string;
		MATRIX_ALLOWED_ROOMS: string;
		npm_execpath: string;
		file_read_max_chars: string;
		VIRTUAL_ENV: string;
		TERMINAL_SINGULARITY_IMAGE: string;
		SLACK_REQUIRE_MENTION: string;
		_CE_CONDA: string;
		SLACK_ALLOWED_CHANNELS: string;
		PATH: string;
		HERMES_AGENT_TIMEOUT_WARNING: string;
		npm_package_json: string;
		_: string;
		npm_config_userconfig: string;
		npm_config_init_module: string;
		BROWSERBASE_ADVANCED_STEALTH: string;
		HERMES_REDACT_SECRETS: string;
		CONDA_PREFIX: string;
		npm_command: string;
		hooks_auto_accept: string;
		TERMINAL_DAYTONA_IMAGE: string;
		PWD: string;
		GVM_VERSION: string;
		HERMES_SESSION_CHAT_NAME: string;
		npm_lifecycle_event: string;
		EDITOR: string;
		npm_package_name: string;
		TERMINAL_DOCKER_MOUNT_CWD_TO_WORKSPACE: string;
		_config_version: string;
		prefill_messages_file: string;
		HERMES_SESSION_USER_ID: string;
		DISCORD_HISTORY_BACKFILL_LIMIT: string;
		npm_config_npm_version: string;
		HERMES_SESSION_PLATFORM: string;
		XPC_FLAGS: string;
		TERMINAL_MODAL_IMAGE: string;
		TERMINAL_TIMEOUT: string;
		TERMINAL_DOCKER_IMAGE: string;
		npm_config_node_gyp: string;
		TERMINAL_CONTAINER_MEMORY: string;
		npm_package_version: string;
		TERMINAL_CWD: string;
		XPC_SERVICE_NAME: string;
		_CONDA_ROOT: string;
		TERMINAL_VERCEL_RUNTIME: string;
		_CE_M: string;
		TELEGRAM_REACTIONS: string;
		SHLVL: string;
		HOME: string;
		HERMES_AGENT_TIMEOUT: string;
		DISCORD_REACTIONS: string;
		npm_config_cache: string;
		CONDA_PYTHON_EXE: string;
		LOGNAME: string;
		npm_lifecycle_script: string;
		SLACK_FREE_RESPONSE_CHANNELS: string;
		LC_CTYPE: string;
		BROWSERBASE_PROXIES: string;
		CONDA_DEFAULT_ENV: string;
		npm_config_user_agent: string;
		DISCORD_THREAD_REQUIRE_MENTION: string;
		TERMINAL_DOCKER_RUN_AS_HOST_USER: string;
		HERMES_SESSION_ID: string;
		BROWSER_SESSION_TIMEOUT: string;
		TERMINAL_DOCKER_FORWARD_ENV: string;
		DISPLAY: string;
		OSLogRateLimit: string;
		HERMES_AUTO_CONTINUE_FRESHNESS: string;
		TERMINAL_CONTAINER_DISK: string;
		HERMES_EXEC_ASK: string;
		npm_node_execpath: string;
		npm_config_prefix: string;
		group_sessions_per_user: string;
		GVM_PATH_BACKUP: string;
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
