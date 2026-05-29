<script lang="ts">
  import type { WallPolicy } from "$lib/api/types";

  type Props = {
    value?: WallPolicy;
    disabled?: boolean;
    onChange?: (value: WallPolicy) => void;
  };

  let { value = "approved_only", disabled = false, onChange }: Props = $props();

  function handleChange(event: Event) {
    const next = (event.currentTarget as HTMLSelectElement).value as WallPolicy;
    onChange?.(next);
  }
</script>

<label class="block space-y-2">
  <span class="text-xs font-semibold text-[#8b7355]">牆面顯示模式</span>
  <select
    value={value}
    disabled={disabled}
    onchange={handleChange}
    class="w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm text-[#3d2b1f] shadow-sm focus:border-[#d4a373] focus:outline-none"
  >
    <option value="approved_only">只顯示已審核</option>
    <option value="all_uploads">顯示全部上傳</option>
  </select>
</label>
