import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seçin...',
  emptyDisplay,
  searchPlaceholder = 'Arayın...',
  query: controlledQuery,
  onQueryChange,
  openOnFocus = true,
  className = ''
}) {
  const [internalQuery, setInternalQuery] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const popupRef = useRef(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const listboxId = `searchable-select-${useId()}`;
  const selectedOption = options.find((option) => String(option.value) === String(value));
  const query = controlledQuery !== undefined ? controlledQuery : (internalQuery ?? (String(value ?? '') === '' ? (emptyDisplay ?? selectedOption?.label) : selectedOption?.label) ?? '');

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      [option.label, option.description, ...(option.searchTerms || [])]
        .some((item) => String(item || '').toLocaleLowerCase('tr-TR').includes(normalizedQuery))
    );
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleOutsideClick(event) {
      if (!rootRef.current?.contains(event.target) && !popupRef.current?.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const updatePosition = () => {
      const input = rootRef.current?.querySelector('[role="combobox"]');
      if (!input) return;
      const rect = input.getBoundingClientRect();
      setPopupPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(120, Math.min(240, window.innerHeight - rect.bottom - 12))
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  function updateQuery(nextQuery) {
    if (controlledQuery === undefined) setInternalQuery(nextQuery);
    onQueryChange?.(nextQuery);
  }

  function choose(option) {
    if (!option) return;
    onChange(option);
    const displayLabel = String(option.value ?? '') === '' && emptyDisplay ? emptyDisplay : option.label;
    if (controlledQuery === undefined) updateQuery(displayLabel);
    else onQueryChange?.(displayLabel);
    setIsOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setIsOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen && !openOnFocus && value) updateQuery('');
      setIsOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(filteredOptions.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && isOpen) {
      event.preventDefault();
      choose(filteredOptions[activeIndex]);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400"><Search size={16} /></span>
        <input
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={query}
          onFocus={(event) => {
            if (!openOnFocus) {
              event.currentTarget.select();
              setIsOpen(false);
              return;
            }
            if (!isOpen && (value || query)) updateQuery('');
            setIsOpen(true);
          }}
          onChange={(event) => {
            updateQuery(event.target.value);
            setActiveIndex(0);
            setIsOpen(true);
            if (value) onChange(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={searchPlaceholder || placeholder}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
        />
        <button
          type="button"
          aria-label={isOpen ? 'Seçenekleri kapat' : 'Seçenekleri aç'}
          aria-expanded={isOpen}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (!isOpen && value) updateQuery('');
            setIsOpen((open) => !open);
          }}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-700"
        >
          <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && popupPosition && createPortal(
        <div ref={popupRef} id={listboxId} role="listbox" style={{ position: 'fixed', top: popupPosition.top, left: popupPosition.left, width: popupPosition.width, maxHeight: popupPosition.maxHeight }} className="z-[10000] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {filteredOptions.length ? filteredOptions.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={String(option.value) === String(value)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm focus:outline-none ${index === activeIndex ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-800">{option.label}</span>
                {option.description && <span className="block truncate text-xs text-slate-500">{option.description}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                {option.meta}
                {String(option.value) === String(value) && <Check size={15} className="text-indigo-600" />}
              </span>
            </button>
          )) : (
            <p className="px-4 py-3 text-sm text-slate-500">{query ? 'Eşleşen kayıt bulunamadı.' : placeholder}</p>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
