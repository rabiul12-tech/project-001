'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Edit3,
  Archive,
  Eye,
  Download,
  ArrowUpDown,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceAction } from '@/hooks/useWorkspaceAction';
import { useDirectorySearch } from '@/hooks/useDirectorySearch';
import { calculateProductPerformance } from '@/lib/calculations/analytics';
import {
  convertRowsToCsv,
  formatCurrency,
  triggerBrowserDownload,
} from '@/lib/export/exporter';
import {
  productFormSchema,
  ProductFormValues,
} from '@/lib/validation/schemas';
import {
  KPIStatCard,
  PageHeader,
  ProductArtwork,
  StatusBadge,
} from '@/components/ui/primitives';
import {
  DetailDrawer,
  EmptyState,
  ModalDialog,
  Pagination,
} from '@/components/ui/overlays';
import { Product, ProductCategory, ProductStatus } from '@/types';
import { canPerformAction, getPermissionDeniedMessage } from '@/lib/permissions';

function ProductsCatalogContent() {
  const searchParams = useSearchParams();
  const products = useAppStore((s) => s.products);
  const orders = useAppStore((s) => s.orders);
  const settings = useAppStore((s) => s.settings);
  const addProduct = useWorkspaceAction((s) => s.addProduct);
  const updateProduct = useWorkspaceAction((s) => s.updateProduct);
  const archiveProducts = useWorkspaceAction((s) => s.archiveProducts);
  const addToast = useAppStore((s) => s.addToast);
  const canMutateProducts = canPerformAction(settings.activeRolePreview, 'mutate_products');

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const { searchQuery, setSearchQuery, page, setPage } = useDirectorySearch(searchParams.get('search') ?? '');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'All'>('All');
  const [sortField, setSortField] = useState<'grossRevenue' | 'unitPrice' | 'stockLevel' | 'name'>('grossRevenue');
  const [sortAsc, setSortAsc] = useState(false);
  const sortDirection = sortAsc ? 'ascending' : 'descending';
  const [pageSize, setPageSize] = useState(10);

  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      sku: 'ENT-2090',
      name: '',
      category: 'Enterprise Software',
      unitPrice: 2400,
      costPrice: 480,
      stockLevel: 100,
      status: 'Active',
      description: '',
    },
  });

  const perfMap = useMemo(() => {
    const rows = calculateProductPerformance(products, orders);
    const map = new Map<string, { unitsSold: number; ordersCount: number; grossRevenue: number }>();
    for (const r of rows) {
      map.set(r.productId, {
        unitsSold: r.unitsSold,
        ordersCount: r.ordersCount,
        grossRevenue: r.grossRevenue,
      });
    }
    return map;
  }, [products, orders]);

  const enrichedProducts = useMemo(() => {
    return products.map((p) => {
      const perf = perfMap.get(p.id) || { unitsSold: 0, ordersCount: 0, grossRevenue: 0 };
      return {
        ...p,
        unitsSold: perf.unitsSold,
        ordersCount: perf.ordersCount,
        grossRevenue: perf.grossRevenue,
      };
    });
  }, [products, perfMap]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedProducts
      .filter((p) => {
        if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
        if (statusFilter !== 'All' && p.status !== statusFilter) return false;
        if (q) {
          return (
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'grossRevenue') diff = a.grossRevenue - b.grossRevenue;
        else if (sortField === 'unitPrice') diff = a.unitPrice - b.unitPrice;
        else if (sortField === 'stockLevel') diff = a.stockLevel - b.stockLevel;
        else diff = a.name.localeCompare(b.name);
        return sortAsc ? diff : -diff;
      });
  }, [enrichedProducts, searchQuery, categoryFilter, statusFilter, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredProducts, safePage, pageSize]
  );

  const openCreateModal = () => {
    if (!canMutateProducts) {
      addToast(
        'Permission restricted',
        getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_products'),
        'warning'
      );
      return;
    }
    setEditingProduct(null);
    reset({
      sku: `ENT-${1000 + products.length * 7}`,
      name: '',
      category: 'Enterprise Software',
      unitPrice: 2400,
      costPrice: 480,
      stockLevel: 120,
      status: 'Active',
      description: 'Enterprise-grade software license module with real-time telemetry integration.',
    });
    setModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    if (!canMutateProducts) {
      addToast(
        'Permission restricted',
        getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_products'),
        'warning'
      );
      return;
    }
    setEditingProduct(prod);
    reset({
      sku: prod.sku,
      name: prod.name,
      category: prod.category,
      unitPrice: prod.unitPrice,
      costPrice: prod.costPrice,
      stockLevel: prod.stockLevel,
      status: prod.status,
      description: prod.description,
    });
    setModalOpen(true);
  };

  const onSubmitForm = async (values: ProductFormValues) => {
    if (!canMutateProducts) {
      addToast(
        'Permission restricted',
        getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_products'),
        'warning'
      );
      return;
    }
    if (editingProduct) {
      await updateProduct(editingProduct.id, values);
      setModalOpen(false);
    } else {
      const created = await addProduct(values);
      if (created) setModalOpen(false);
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
    setPage(1);
  };

  const handleExportCatalog = () => {
    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Status',
      'Current Unit Price',
      'Cost Price',
      'Stock Level',
      'Units Sold',
      'Historical Gross Revenue',
    ];
    const rows = filteredProducts.map((p) => [
      p.sku,
      p.name,
      p.category,
      p.status,
      p.unitPrice,
      p.costPrice,
      p.stockLevel,
      p.unitsSold,
      p.grossRevenue,
    ]);
    triggerBrowserDownload(convertRowsToCsv(headers, rows), 'aurelix-product-catalog.csv');
    addToast('Product catalog exported', `Downloaded ${rows.length} SKU records.`, 'success');
  };

  const activeSkus = products.filter((p) => p.status === 'Active').length;
  const lowStockSkus = products.filter((p) => p.status === 'Low Stock').length;
  const archivedSkus = products.filter((p) => p.status === 'Archived').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Catalog & SKU Velocity"
        subtitle="Manage enterprise license tiers, infrastructure nodes, stock allocations, and unit pricing schedules."
        meta={`${products.length} Total SKUs · Price Locking Active`}
        actions={
          <>
            <button
              type="button"
              onClick={handleExportCatalog}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-surface-raised border border-line text-ink-secondary hover:bg-surface-hover transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Catalog CSV</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              disabled={!canMutateProducts}
              title={!canMutateProducts ? getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_products') : undefined}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Product</span>
            </button>
          </>
        }
      />

      {/* Catalog Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIStatCard
          label="Total Catalog SKUs"
          value={products.length.toLocaleString()}
          secondaryMeta="Across 6 categories"
        />
        <KPIStatCard
          label="Active Available SKUs"
          value={activeSkus.toLocaleString()}
          secondaryMeta="Healthy inventory allocation"
        />
        <KPIStatCard
          label="Low Stock Alerts"
          value={lowStockSkus.toLocaleString()}
          secondaryMeta="≤ 14 units remaining"
        />
        <KPIStatCard
          label="Archived SKUs"
          value={archivedSkus.toLocaleString()}
          secondaryMeta="Historical orders preserved"
        />
      </div>

      {/* Filter & View Mode Toolbar */}
      <div className="p-4 rounded-xl bg-surface-raised border border-line flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search products"
              placeholder="Search SKU, product name, category..."
              className="pl-8 pr-3 py-2 w-64 rounded-lg bg-surface-sunken border border-line text-xs text-ink focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter by product category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as ProductCategory | 'All');
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs text-ink-secondary"
          >
            <option value="All">All Categories</option>
            <option value="Enterprise Software">Enterprise Software</option>
            <option value="Cloud Infrastructure">Cloud Infrastructure</option>
            <option value="Data Intelligence">Data Intelligence</option>
            <option value="Security & Compliance">Security & Compliance</option>
            <option value="API & Integrations">API & Integrations</option>
            <option value="Advisory Retainer">Advisory Retainer</option>
          </select>

          <select
            aria-label="Filter by product status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ProductStatus | 'All');
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs text-ink-secondary"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        {/* Table / Grid Toggle */}
        <div role="group" aria-label="Product view" className="flex items-center gap-1 p-1 rounded-lg bg-surface-sunken border border-line self-start">
          <button
            type="button"
            aria-pressed={viewMode === 'table'}
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-surface-hover text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
          <button
            type="button"
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'grid'
                ? 'bg-surface-hover text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>
        </div>
      </div>

      {/* Product Display */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          title="No products match your filter criteria"
          description="Clear your search query or create a new catalog SKU."
          actionLabel="Reset Product Filters"
          onAction={() => {
            setSearchQuery('');
            setCategoryFilter('All');
            setStatusFilter('All');
            setPage(1);
          }}
        />
      ) : viewMode === 'table' ? (
        <div className="rounded-xl bg-surface-raised border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm table-sticky-first">
              <thead>
                <tr className="border-b border-line bg-surface-sunken/60 text-caption font-semibold text-ink-muted">
                  <th scope="col" aria-sort={sortField === 'name' ? sortDirection : undefined} className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Product / SKU</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th scope="col" className="py-3 px-4">Category</th>
                  <th scope="col" className="py-3 px-4">Status</th>
                  <th scope="col" aria-sort={sortField === 'unitPrice' ? sortDirection : undefined} className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('unitPrice')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Unit Price</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th scope="col" aria-sort={sortField === 'stockLevel' ? sortDirection : undefined} className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('stockLevel')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Inventory</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th scope="col" aria-sort={sortField === 'grossRevenue' ? sortDirection : undefined} className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('grossRevenue')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Gross Revenue</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th scope="col" className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {paginatedProducts.map((prod) => (
                  <tr
                    key={prod.id}
                    onClick={() => setDrawerProduct(prod)}
                    className="hover:bg-surface-hover/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="flex items-center gap-3">
                        <ProductArtwork category={prod.category} sku={prod.sku} size="sm" />
                        <div className="min-w-0">
                          <div className="font-semibold text-ink truncate" title={prod.name}>
                            {prod.name}
                          </div>
                          <div className="tabular-nums text-xs text-ink-muted">{prod.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-ink-secondary">
                      {prod.category}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={prod.status} />
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-ink">
                      {formatCurrency(prod.unitPrice, settings.currency, settings.numberFormat)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span
                        className={
                          prod.stockLevel <= 14
                            ? 'text-warning font-semibold'
                            : 'text-ink-secondary'
                        }
                      >
                        {prod.stockLevel} units
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-success font-semibold">
                      {formatCurrency(prod.grossRevenue, settings.currency, settings.numberFormat)}
                      <div className="text-xs text-ink-muted font-normal">
                        {prod.unitsSold} sold
                      </div>
                    </td>
                    <td
                      className="py-3 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDrawerProduct(prod)}
                          aria-label={`View ${prod.name}`}
                          className="p-2 rounded-lg text-ink-muted hover:text-blue-600 hover:bg-surface-hover"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(prod)}
                          disabled={!canMutateProducts}
                          title={!canMutateProducts ? getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_products') : undefined}
                          aria-label={`Edit ${prod.name}`}
                          className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {prod.status !== 'Archived' && (
                          <button
                            type="button"
                            onClick={() => archiveProducts([prod.id])}
                            disabled={!canMutateProducts}
                            title={!canMutateProducts ? getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_products') : undefined}
                            aria-label={`Archive ${prod.name}`}
                            className="p-2 rounded-lg text-ink-muted hover:text-amber-600 hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedProducts.map((prod) => (
              <div
                key={prod.id}
                className="relative p-6 rounded-xl bg-surface-raised border border-line hover:border-blue-500/40 transition-colors flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <ProductArtwork category={prod.category} sku={prod.sku} size="md" />
                    <StatusBadge status={prod.status} />
                  </div>
                  <div>
                    <div className="text-caption tabular-nums text-ink-muted">
                      {prod.sku} · {prod.category}
                    </div>
                    <h3 className="text-subheading text-ink mt-1">
                      <button
                        type="button"
                        aria-label={`View ${prod.name}`}
                        onClick={() => setDrawerProduct(prod)}
                        className="text-left cursor-pointer after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-accent"
                      >
                        {prod.name}
                      </button>
                    </h3>
                    <p className="text-xs text-ink-secondary mt-1 line-clamp-2 leading-relaxed">
                      {prod.description}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-line-subtle flex items-center justify-between text-xs">
                  <div>
                    <div className="text-caption text-ink-muted">Catalog Price</div>
                    <div className="tabular-nums font-bold text-base text-ink">
                      {formatCurrency(prod.unitPrice, settings.currency, settings.numberFormat)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-ink-muted">Stock · Sold</div>
                    <div className="tabular-nums text-ink-secondary">
                      {prod.stockLevel} avail · {prod.unitsSold} sold
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-surface-raised border border-line">
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={filteredProducts.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* Create / Edit Product Modal */}
      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? `Edit Product · ${editingProduct.sku}` : 'Create Catalog Product'}
        subtitle="Note: Editing a product's unit price updates future orders while keeping historical order prices locked."
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="product-sku" className="block font-medium text-ink-secondary mb-1">
                SKU Code
              </label>
              <input
                type="text"
                id="product-sku"
                aria-invalid={Boolean(errors.sku)}
                aria-describedby={errors.sku ? 'product-sku-error' : undefined}
                {...register('sku')}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
              />
              {errors.sku && (
                <p id="product-sku-error" role="alert" className="text-danger text-xs mt-1">{errors.sku.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="product-category" className="block font-medium text-ink-secondary mb-1">
                Category
              </label>
              <select
                id="product-category"
                {...register('category')}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
              >
                <option value="Enterprise Software">Enterprise Software</option>
                <option value="Cloud Infrastructure">Cloud Infrastructure</option>
                <option value="Data Intelligence">Data Intelligence</option>
                <option value="Security & Compliance">Security & Compliance</option>
                <option value="API & Integrations">API & Integrations</option>
                <option value="Advisory Retainer">Advisory Retainer</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="product-name" className="block font-medium text-ink-secondary mb-1">
              Product Name
            </label>
            <input
              type="text"
              id="product-name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'product-name-error' : undefined}
              {...register('name')}
              placeholder="Aurelix Treasury Risk Engine"
              className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
            />
            {errors.name && (
              <p id="product-name-error" role="alert" className="text-danger text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="product-unit-price" className="block font-medium text-ink-secondary mb-1">
                Unit Price ($)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max="1000000"
                id="product-unit-price"
                aria-invalid={Boolean(errors.unitPrice)}
                aria-describedby={errors.unitPrice ? 'product-unit-price-error' : undefined}
                {...register('unitPrice', { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
              />
              {errors.unitPrice && (
                <p id="product-unit-price-error" role="alert" className="text-danger text-xs mt-1">{errors.unitPrice.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="product-cost-price" className="block font-medium text-ink-secondary mb-1">
                Unit Cost ($)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="1000000"
                id="product-cost-price"
                aria-invalid={Boolean(errors.costPrice)}
                aria-describedby={errors.costPrice ? 'product-cost-price-error' : undefined}
                {...register('costPrice', { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
              />
              {errors.costPrice && (
                <p id="product-cost-price-error" role="alert" className="text-danger text-xs mt-1">{errors.costPrice.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="product-stock-level" className="block font-medium text-ink-secondary mb-1">
                Stock Level
              </label>
              <input
                type="number"
                id="product-stock-level"
                aria-invalid={Boolean(errors.stockLevel)}
                aria-describedby={errors.stockLevel ? 'product-stock-level-error' : undefined}
                {...register('stockLevel', { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
              />
              {errors.stockLevel && (
                <p id="product-stock-level-error" role="alert" className="text-danger text-xs mt-1">{errors.stockLevel.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="product-status" className="block font-medium text-ink-secondary mb-1">
                Status
              </label>
              <select
                id="product-status"
                {...register('status')}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
              >
                <option value="Active">Active</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="product-description" className="block font-medium text-ink-secondary mb-1">
              Technical Description
            </label>
            <textarea
              rows={3}
              id="product-description"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'product-description-error' : undefined}
              {...register('description')}
              className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
            />
            {errors.description && (
              <p id="product-description-error" role="alert" className="text-danger text-xs mt-1">{errors.description.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-line"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-accent-strong hover:bg-accent-strong-hover text-white font-semibold"
            >
              {editingProduct ? 'Save Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Product Detail Drawer */}
      <DetailDrawer
        open={Boolean(drawerProduct)}
        onClose={() => setDrawerProduct(null)}
        title={drawerProduct?.name || 'Product Details'}
        subtitle={drawerProduct ? `${drawerProduct.sku} · ${drawerProduct.category}` : undefined}
        footer={
          drawerProduct && (
            <>
              <button
                type="button"
                disabled={!canMutateProducts}
                title={!canMutateProducts ? getPermissionDeniedMessage(settings.activeRolePreview, 'mutate_products') : undefined}
                onClick={() => {
                  const p = drawerProduct;
                  setDrawerProduct(null);
                  openEditModal(p);
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium border border-line disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Edit Product
              </button>
              <button
                type="button"
                onClick={() => setDrawerProduct(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-accent-strong text-white"
              >
                Close
              </button>
            </>
          )
        }
      >
        {drawerProduct && (
          <div className="space-y-6 text-xs">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-sunken border border-line">
              <ProductArtwork category={drawerProduct.category} sku={drawerProduct.sku} size="lg" />
              <div className="space-y-1">
                <div className="tabular-nums text-ink-muted">{drawerProduct.sku}</div>
                <div className="text-heading text-ink">
                  {drawerProduct.name}
                </div>
                <StatusBadge status={drawerProduct.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-surface-sunken border border-line">
                <div className="text-caption text-ink-muted">Current Unit Price</div>
                <div className="text-base sm:text-heading font-semibold tabular-nums mt-1">
                  {formatCurrency(drawerProduct.unitPrice, settings.currency, settings.numberFormat)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-surface-sunken border border-line">
                <div className="text-caption text-ink-muted">Gross Margin</div>
                <div className="text-base sm:text-heading font-semibold tabular-nums text-success mt-1">
                  {drawerProduct.unitPrice > 0
                    ? `${Math.round(((drawerProduct.unitPrice - drawerProduct.costPrice) / drawerProduct.unitPrice) * 100)}%`
                    : '0%'}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-surface-sunken border border-line">
                <div className="text-caption text-ink-muted">Available Stock</div>
                <div className="text-base sm:text-heading font-semibold tabular-nums mt-1">
                  {drawerProduct.stockLevel} units
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-2">
              <h3 className="text-subheading text-ink">
                Specification & Historical Price Integrity
              </h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                {drawerProduct.description}
              </p>
              <p className="text-xs text-ink-muted pt-2 border-t border-line-subtle">
                Historical orders referencing {drawerProduct.sku} retain the exact unit price locked at order creation.
              </p>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-ink-muted">Loading product catalog...</div>}>
      <ProductsCatalogContent />
    </Suspense>
  );
}
