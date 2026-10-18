import { useCallback, useEffect, useState } from 'react';
import { clearContentCache, getPublished, isContentSourceAvailable, listPublished, searchAll } from '../services/content';
import type { ContentOptions, ContentPage, ContentRecord, ContentTable, SearchPage } from '../types/content';

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'Unable to load content.'; }

export function useContent(table: ContentTable, options: ContentOptions = {}) {
  const key = JSON.stringify(options);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ result: ContentPage; loading: boolean; error: string | null }>({
    result: { items: [], total: 0, page: options.page || 1, pageSize: options.pageSize || 12, totalPages: 0, configured: isContentSourceAvailable(table) },
    loading: isContentSourceAvailable(table) && options.enabled !== false,
    error: null,
  });
  useEffect(() => {
    let active = true;
    const parsed = JSON.parse(key) as ContentOptions;
    setState((previous) => ({ ...previous, loading: isContentSourceAvailable(table) && parsed.enabled !== false, error: null }));
    listPublished(table, parsed).then((result) => {
      if (active) setState({ result, loading: false, error: null });
    }).catch((error: unknown) => {
      if (active) setState((previous) => ({ ...previous, result: { ...previous.result, items: [], total: 0, totalPages: 0 }, loading: false, error: errorMessage(error) }));
    });
    return () => { active = false; };
  }, [table, key, revision]);
  const refetch = useCallback(() => { clearContentCache(); setRevision((value) => value + 1); }, []);
  return { ...state.result, data: state.result.items, count: state.result.total, loading: state.loading, error: state.error, refetch };
}

export function useRecord(table: ContentTable, slug: string | undefined) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ record: ContentRecord | null; loading: boolean; error: string | null }>({ record: null, loading: isContentSourceAvailable(table) && Boolean(slug), error: null });
  useEffect(() => {
    let active = true;
    setState({ record: null, loading: isContentSourceAvailable(table) && Boolean(slug), error: null });
    getPublished(table, slug ?? '').then((record) => {
      if (active) setState({ record, loading: false, error: null });
    }).catch((error: unknown) => {
      if (active) setState({ record: null, loading: false, error: errorMessage(error) });
    });
    return () => { active = false; };
  }, [table, slug, revision]);
  const refetch = useCallback(() => { clearContentCache(); setRevision((value) => value + 1); }, []);
  return { ...state, data: state.record, configured: isContentSourceAvailable(table), refetch };
}

export function useSearch(query: string, page = 1, onlyTable?: ContentTable) {
  const [state, setState] = useState<{ result: SearchPage; loading: boolean; error: string | null }>({
    result: { items: [], total: 0, page, pageSize: 42, totalPages: 0, configured: isContentSourceAvailable() }, loading: isContentSourceAvailable() && Boolean(query.trim()), error: null,
  });
  useEffect(() => {
    let active = true;
    setState((previous) => ({ ...previous, loading: isContentSourceAvailable() && Boolean(query.trim()), error: null }));
    // Debounce interactive searches without downloading any entire content table.
    const timer = window.setTimeout(() => {
      searchAll(query, page, onlyTable).then((result) => {
        if (active) setState({ result, loading: false, error: null });
      }).catch((error: unknown) => {
        if (active) setState((previous) => ({ ...previous, result: { ...previous.result, items: [], total: 0, totalPages: 0 }, loading: false, error: errorMessage(error) }));
      });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, page, onlyTable]);
  return { ...state.result, data: state.result.items, count: state.result.total, loading: state.loading, error: state.error };
}
