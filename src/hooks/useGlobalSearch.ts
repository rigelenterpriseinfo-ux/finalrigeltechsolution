import { useState, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';

export interface SearchResult {
  id: string;
  type: 'order' | 'invoice' | 'product' | 'customer' | 'supplier';
  title: string;
  subtitle?: string;
  metadata?: Record<string, any>;
  url: string;
}

export const useGlobalSearch = (data: {
  orders?: any[];
  invoices?: any[];
  products?: any[];
  customers?: any[];
  suppliers?: any[];
}) => {
  const [query, setQuery] = useState('');

  // Transform data into searchable format
  const searchableData: SearchResult[] = useMemo(() => {
    const results: SearchResult[] = [];

    // Orders
    data.orders?.forEach(order => {
      results.push({
        id: order.id,
        type: 'order',
        title: `Order ${order.order_number || order.id}`,
        subtitle: `${order.customer_name} - $${order.total_amount}`,
        metadata: order,
        url: `/dashboard?module=sales&view=order&id=${order.id}`,
      });
    });

    // Invoices
    data.invoices?.forEach(invoice => {
      results.push({
        id: invoice.id,
        type: 'invoice',
        title: `Invoice ${invoice.invoice_number || invoice.id}`,
        subtitle: `${invoice.customer_name} - $${invoice.total_amount}`,
        metadata: invoice,
        url: `/dashboard?module=sales&view=invoice&id=${invoice.id}`,
      });
    });

    // Products
    data.products?.forEach(product => {
      results.push({
        id: product.id,
        type: 'product',
        title: product.name || product.product_name,
        subtitle: `SKU: ${product.sku || product.product_sku} - Stock: ${product.quantity || 0}`,
        metadata: product,
        url: `/dashboard?module=inventory&view=product&id=${product.id}`,
      });
    });

    // Customers
    data.customers?.forEach(customer => {
      results.push({
        id: customer.id,
        type: 'customer',
        title: customer.name || customer.customer_name,
        subtitle: customer.email || customer.phone,
        metadata: customer,
        url: `/dashboard?module=sales&view=customer&id=${customer.id}`,
      });
    });

    // Suppliers
    data.suppliers?.forEach(supplier => {
      results.push({
        id: supplier.id,
        type: 'supplier',
        title: supplier.name,
        subtitle: supplier.email || supplier.phone,
        metadata: supplier,
        url: `/dashboard?module=purchase&view=supplier&id=${supplier.id}`,
      });
    });

    return results;
  }, [data]);

  // Setup fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(searchableData, {
      keys: ['title', 'subtitle', 'metadata.description'],
      threshold: 0.3,
      includeScore: true,
    });
  }, [searchableData]);

  // Perform search
  const results = useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    return fuse.search(query).map(result => result.item);
  }, [query, fuse]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const grouped: Record<string, SearchResult[]> = {};
    results.forEach(result => {
      if (!grouped[result.type]) {
        grouped[result.type] = [];
      }
      grouped[result.type].push(result);
    });
    return grouped;
  }, [results]);

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    setQuery,
    results,
    groupedResults,
    clearSearch,
    isSearching: query.trim().length > 0,
  };
};
