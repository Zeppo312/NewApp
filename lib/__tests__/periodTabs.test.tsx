import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PeriodTabs, SelectionTabs } from '@/components/ui/period-tabs';

jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ui/home-glass', () => ({ HomeGlassSurface: jest.requireActual('react-native').View }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light' }) }));
let tree: ReactTestRenderer;
afterEach(() => act(() => tree?.unmount()));
const labels = { day: 'Tag', week: 'Woche', month: 'Monat' };
const tab = (label: string) => tree.root.findAll(node => node.props.accessibilityRole === 'tab'
  && node.props.accessibilityLabel === label && typeof node.props.style === 'function')[0];

it('keeps locked months actionable so the screen can explain access, without changing selection itself', () => {
  const onSelect = jest.fn();
  act(() => { tree = create(<PeriodTabs labels={labels} value="day" isDark={false} monthLocked onSelect={onSelect} />); });
  act(() => tab('Monat').props.onPress());
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith('month');
  expect(tab('Tag').props.accessibilityState.selected).toBe(true);
  expect(tab('Monat').props.accessibilityState.selected).toBe(false);
});

it('reflects the screen selection after an accepted navigation and keeps localized names', () => {
  const onSelect = jest.fn();
  const translated = { day: 'Día', week: 'Semana', month: 'Mes' };
  act(() => { tree = create(<PeriodTabs labels={translated} value="day" isDark onSelect={onSelect} />); });
  act(() => tab('Semana').props.onPress());
  expect(onSelect).toHaveBeenCalledWith('week');
  act(() => tree.update(<PeriodTabs labels={translated} value="week" isDark onSelect={onSelect} />));
  expect(tab('Semana').props.accessibilityState.selected).toBe(true);
  expect(tab('Día').props.accessibilityState.selected).toBe(false);
});

it('delegates all growth ranges to the screen, including year and complete history', () => {
  const onSelect = jest.fn();
  const options = [
    { value: 'week', label: 'Woche' }, { value: 'month', label: 'Monat' },
    { value: 'year', label: 'Jahr' }, { value: 'all', label: 'Gesamt' },
  ] as const;
  act(() => { tree = create(<SelectionTabs value="month" options={options} isDark={false} onSelect={onSelect} />); });
  act(() => tab('Jahr').props.onPress());
  act(() => tab('Gesamt').props.onPress());
  expect(onSelect.mock.calls).toEqual([['year'], ['all']]);
  expect(tab('Monat').props.accessibilityState.selected).toBe(true);
  act(() => tree.update(<SelectionTabs value="all" options={options} isDark={false} onSelect={onSelect} />));
  expect(tab('Gesamt').props.accessibilityState.selected).toBe(true);
  expect(tab('Monat').props.accessibilityState.selected).toBe(false);
});

it('supports localized milestone categories and form buttons without treating them as dates', () => {
  const onSelect = jest.fn();
  const options = [{ value: 'motorik', label: 'Movimiento' }, { value: 'ernaehrung', label: 'Alimentación' }] as const;
  act(() => { tree = create(<SelectionTabs value="motorik" options={options} isDark accessibilityRole="button" onSelect={onSelect} />); });
  const food = tree.root.findAll(node => node.props.accessibilityRole === 'button'
    && node.props.accessibilityLabel === 'Alimentación' && typeof node.props.style === 'function')[0];
  act(() => food.props.onPress());
  expect(onSelect).toHaveBeenCalledWith('ernaehrung');
  expect(food.props.accessibilityState.selected).toBe(false);
});
