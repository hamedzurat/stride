<script lang="ts">
  import File from '@lucide/svelte/icons/file';

  let { title }: { title: string } = $props();

  const ext = $derived((title.split('.').pop() || '').toLowerCase());

  interface FileTypeConfig {
    label: string;
    bgClass: string;
    borderClass: string;
    textClass: string;
    isCustomSvg?: boolean;
  }

  const config = $derived.by<FileTypeConfig>(() => {
    switch (ext) {
      case 'py':
        return {
          label: 'PY',
          bgClass: 'bg-sky-500/10',
          borderClass: 'border-sky-500/20',
          textClass: 'text-sky-500',
          isCustomSvg: true,
        };
      case 'js':
      case 'jsx':
        return {
          label: 'JS',
          bgClass: 'bg-yellow-500/10',
          borderClass: 'border-yellow-500/20',
          textClass: 'text-yellow-600 dark:text-yellow-500',
        };
      case 'ts':
      case 'tsx':
        return {
          label: 'TS',
          bgClass: 'bg-blue-500/10',
          borderClass: 'border-blue-500/20',
          textClass: 'text-blue-600 dark:text-blue-400',
        };
      case 'cpp':
      case 'hpp':
      case 'c':
      case 'h':
      case 'cc':
      case 'cxx':
        return {
          label: 'C++',
          bgClass: 'bg-indigo-500/10',
          borderClass: 'border-indigo-500/20',
          textClass: 'text-indigo-600 dark:text-indigo-400',
        };
      case 'java':
      case 'class':
      case 'jar':
        return {
          label: 'JAVA',
          bgClass: 'bg-orange-600/10',
          borderClass: 'border-orange-600/20',
          textClass: 'text-orange-600 dark:text-orange-400',
        };
      case 'svelte':
        return {
          label: 'SVT',
          bgClass: 'bg-rose-500/10',
          borderClass: 'border-rose-500/20',
          textClass: 'text-rose-600 dark:text-rose-500',
        };
      case 'html':
      case 'htm':
        return {
          label: 'HTML',
          bgClass: 'bg-amber-500/10',
          borderClass: 'border-amber-500/20',
          textClass: 'text-amber-600 dark:text-amber-500',
        };
      case 'css':
      case 'scss':
      case 'less':
        return {
          label: 'CSS',
          bgClass: 'bg-teal-500/10',
          borderClass: 'border-teal-500/20',
          textClass: 'text-teal-600 dark:text-teal-400',
        };
      case 'go':
        return {
          label: 'GO',
          bgClass: 'bg-cyan-500/10',
          borderClass: 'border-cyan-500/20',
          textClass: 'text-cyan-600 dark:text-cyan-400',
        };
      case 'rs':
        return {
          label: 'RUST',
          bgClass: 'bg-orange-700/10',
          borderClass: 'border-orange-700/20',
          textClass: 'text-orange-700 dark:text-orange-400',
        };
      case 'rb':
        return {
          label: 'RUBY',
          bgClass: 'bg-red-600/10',
          borderClass: 'border-red-600/20',
          textClass: 'text-red-600 dark:text-red-400',
        };
      case 'php':
        return {
          label: 'PHP',
          bgClass: 'bg-violet-600/10',
          borderClass: 'border-violet-600/20',
          textClass: 'text-violet-600 dark:text-violet-400',
        };
      case 'sh':
      case 'bash':
      case 'zsh':
        return {
          label: 'SH',
          bgClass: 'bg-lime-600/10',
          borderClass: 'border-lime-600/20',
          textClass: 'text-lime-600 dark:text-lime-400',
        };
      case 'json':
        return {
          label: 'JSON',
          bgClass: 'bg-amber-500/10',
          borderClass: 'border-amber-500/20',
          textClass: 'text-amber-600 dark:text-amber-400',
        };
      case 'yaml':
      case 'yml':
        return {
          label: 'YML',
          bgClass: 'bg-purple-600/10',
          borderClass: 'border-purple-600/20',
          textClass: 'text-purple-600 dark:text-purple-400',
        };
      case 'sql':
        return {
          label: 'SQL',
          bgClass: 'bg-sky-600/10',
          borderClass: 'border-sky-600/20',
          textClass: 'text-sky-600 dark:text-sky-400',
        };
      case 'pdf':
        return {
          label: 'PDF',
          bgClass: 'bg-red-500/10',
          borderClass: 'border-red-500/20',
          textClass: 'text-red-600 dark:text-red-400',
        };
      case 'doc':
      case 'docx':
      case 'odt':
        return {
          label: 'DOC',
          bgClass: 'bg-blue-600/10',
          borderClass: 'border-blue-600/20',
          textClass: 'text-blue-600 dark:text-blue-400',
        };
      case 'xls':
      case 'xlsx':
      case 'csv':
      case 'ods':
        return {
          label: 'XLS',
          bgClass: 'bg-emerald-600/10',
          borderClass: 'border-emerald-600/20',
          textClass: 'text-emerald-600 dark:text-emerald-500',
        };
      case 'ppt':
      case 'pptx':
      case 'odp':
        return {
          label: 'PPT',
          bgClass: 'bg-orange-500/10',
          borderClass: 'border-orange-500/20',
          textClass: 'text-orange-600 dark:text-orange-400',
        };
      case 'txt':
      case 'rtf':
        return {
          label: 'TXT',
          bgClass: 'bg-gray-500/10',
          borderClass: 'border-gray-500/20',
          textClass: 'text-gray-600 dark:text-gray-400',
        };
      case 'md':
        return {
          label: 'MD',
          bgClass: 'bg-violet-500/10',
          borderClass: 'border-violet-500/20',
          textClass: 'text-violet-600 dark:text-violet-400',
        };
      case 'zip':
      case 'rar':
      case 'tar':
      case 'gz':
      case '7z':
        return {
          label: 'ZIP',
          bgClass: 'bg-amber-600/10',
          borderClass: 'border-amber-600/20',
          textClass: 'text-amber-600 dark:text-amber-500',
        };
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
      case 'svg':
        return {
          label: 'IMG',
          bgClass: 'bg-blue-500/10',
          borderClass: 'border-blue-500/20',
          textClass: 'text-blue-500',
        };
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'mkv':
      case 'webm':
        return {
          label: 'VID',
          bgClass: 'bg-purple-500/10',
          borderClass: 'border-purple-500/20',
          textClass: 'text-purple-500',
        };
      case 'mp3':
      case 'wav':
      case 'flac':
      case 'ogg':
      case 'aac':
        return {
          label: 'AUD',
          bgClass: 'bg-emerald-500/10',
          borderClass: 'border-emerald-500/20',
          textClass: 'text-emerald-500',
        };
      default:
        return { label: '', bgClass: 'bg-gray-500/10', borderClass: 'border-gray-500/20', textClass: 'text-gray-500' };
    }
  });
</script>

<div class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold select-none">
  {#if config.isCustomSvg}
    <div
      class="flex h-8 w-8 items-center justify-center rounded-lg border {config.borderClass} {config.bgClass}"
      title="{config.label} File"
    >
      <svg class="h-5.5 w-5.5" viewBox="0 0 24 24" fill="none">
        <path
          d="M11.9 2C8.6 2 8 2.6 8 5.7V8.5H12V9H6.5C3.5 9 2.9 9.8 2.9 12.8C2.9 15.9 3.5 16.5 6.7 16.5H8.7V15C8.7 13 10.2 11.5 12.2 11.5H15.5C18.5 11.5 19.1 10.9 19.1 7.9C19.1 4.8 18.5 4.2 15.3 4.2H14.3V5.5C14.3 6.9 13.2 8 11.8 8C10.4 8 9.3 6.9 9.3 5.5V2H11.9Z"
          fill="#38BDF8"
        />
        <path
          d="M12.1 22C15.4 22 16 21.4 16 18.3V15.5H12V15H17.5C20.5 15 21.1 14.2 21.1 11.2C21.1 8.1 20.5 7.5 17.3 7.5H15.3V9C15.3 11 13.8 12.5 11.8 12.5H8.5C5.5 12.5 4.9 13.1 4.9 16.1C4.9 19.2 5.5 19.8 8.7 19.8H9.7V18.5C9.7 17.1 10.8 16 12.2 16C13.6 16 14.7 17.1 14.7 18.5V22H12.1Z"
          fill="#FACC15"
        />
      </svg>
    </div>
  {:else if config.label !== ''}
    <div
      class="flex h-8 w-8 items-center justify-center rounded-lg border {config.borderClass} {config.bgClass} {config.textClass}"
      title="{config.label} File"
    >
      {config.label}
    </div>
  {:else}
    <div
      class="flex h-8 w-8 items-center justify-center rounded-lg border {config.borderClass} {config.bgClass}"
      title="File"
    >
      <File class="h-4 w-4 {config.textClass}" />
    </div>
  {/if}
</div>
