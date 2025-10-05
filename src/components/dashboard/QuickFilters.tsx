import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardFilters {
  warehouses: string[];
  categories: string[];
}

interface QuickFiltersProps {
  companyId?: string;
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

export const QuickFilters: React.FC<QuickFiltersProps> = ({
  companyId,
  filters,
  onFiltersChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch available warehouses (simplified - no warehouse_location column)
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: async () => {
      // Return placeholder warehouses since column doesn't exist
      return ['Main Warehouse', 'Secondary Warehouse'];
    },
    enabled: !!companyId,
  });

  // Fetch available categories (simplified - no category column)
  const { data: categories } = useQuery({
    queryKey: ['categories', companyId],
    queryFn: async () => {
      // Return placeholder categories since column doesn't exist
      return ['Electronics', 'Furniture', 'Supplies', 'Equipment'];
    },
    enabled: !!companyId,
  });

  const handleWarehouseToggle = (warehouse: string) => {
    const newWarehouses = filters.warehouses.includes(warehouse)
      ? filters.warehouses.filter(w => w !== warehouse)
      : [...filters.warehouses, warehouse];
    
    onFiltersChange({ ...filters, warehouses: newWarehouses });
  };

  const handleCategoryToggle = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handleClearAll = () => {
    onFiltersChange({ warehouses: [], categories: [] });
  };

  const activeFilterCount = filters.warehouses.length + filters.categories.length;

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-full h-5 w-5 p-0 flex items-center justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filters</h4>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-auto p-1 text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>

            {/* Warehouse Filters */}
            {warehouses && warehouses.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Warehouses</label>
                <div className="space-y-2">
                  {warehouses.map((warehouse) => (
                    <div key={warehouse} className="flex items-center space-x-2">
                      <Checkbox
                        id={`warehouse-${warehouse}`}
                        checked={filters.warehouses.includes(warehouse)}
                        onCheckedChange={() => handleWarehouseToggle(warehouse)}
                      />
                      <label
                        htmlFor={`warehouse-${warehouse}`}
                        className="text-sm cursor-pointer"
                      >
                        {warehouse}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Filters */}
            {categories && categories.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Categories</label>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category}`}
                        checked={filters.categories.includes(category)}
                        onCheckedChange={() => handleCategoryToggle(category)}
                      />
                      <label
                        htmlFor={`category-${category}`}
                        className="text-sm cursor-pointer"
                      >
                        {category}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!warehouses || warehouses.length === 0) && (!categories || categories.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No filter options available
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="h-9 px-2"
          aria-label="Clear all filters"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
