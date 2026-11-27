// Applies the deadline to both headers and body. No HTML is injected or executed.
/**
 * @param {string} url
 * @param {{timeoutMs?:number,maxBytes?:number,signal?:AbortSignal,fetchImpl?:typeof fetch}} [options]
 */
export async function readBoundedJson(url, { timeoutMs = 12000, maxBytes = 3000000, signal, fetchImpl = globalThis.fetch } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  let reader, response;
  try {
    response = await fetchImpl(url, { signal: controller.signal, redirect: 'error', cache: 'no-cache', credentials: 'omit' });
    if (!response.ok) throw new Error('Source returned HTTP ' + response.status + '.');
    if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Source payload exceeds the size limit.');
    if (!response.body) throw new Error('Source returned an empty body.');
    reader = response.body.getReader();
    const chunks = []; let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('Source payload exceeds the size limit.');
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (controller.signal.aborted) throw new Error(signal?.aborted ? 'Request cancelled.' : 'Source request timed out.');
    throw error;
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    // Header/HTTP failures happen before a reader exists. Stop the underlying
    // transport as well as cancelling any reader; an unread error/oversize
    // response must not continue downloading after its deadline is cleared.
    controller.abort();
    if (reader) { try { await reader.cancel(); } catch {} reader.releaseLock(); }
    else if (response?.body) { try { await response.body.cancel(); } catch {} }
  }
}
