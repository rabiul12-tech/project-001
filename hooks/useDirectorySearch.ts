'use client';

import { startTransition, useOptimistic, useState } from 'react';

export function useDirectorySearch(urlSearch: string) {
  const [searchQuery, updateOptimisticSearch] = useOptimistic(urlSearch);
  const [pagination, setPagination] = useState({ query: searchQuery, page: 1 });
  const page = pagination.query === searchQuery ? pagination.page : 1;

  const setSearchQuery = (query: string) => {
    const url = new URL(window.location.href);
    if (query) {
      url.searchParams.set('search', query);
    } else {
      url.searchParams.delete('search');
    }
    setPagination({ query, page: 1 });
    startTransition(() => {
      updateOptimisticSearch(query);
      window.history.replaceState(null, '', url);
    });
  };

  const setPage = (page: number) => setPagination({ query: searchQuery, page });

  return { searchQuery, setSearchQuery, page, setPage };
}
