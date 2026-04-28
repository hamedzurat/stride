<script lang="ts">
  import { decode } from 'blurhash';

  let {
    hash,
    width = 32,
    height = 32,
    class: className = '',
  }: {
    hash: string;
    width?: number;
    height?: number;
    class?: string;
  } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();

  $effect(() => {
    if (canvas && hash) {
      try {
        const pixels = decode(hash, width, height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.createImageData(width, height);
          imageData.data.set(pixels);
          ctx.putImageData(imageData, 0, 0);
        }
      } catch (e) {
        console.error('Blurhash decode error:', e);
      }
    }
  });
</script>

<canvas bind:this={canvas} {width} {height} class="h-full w-full {className}"></canvas>
