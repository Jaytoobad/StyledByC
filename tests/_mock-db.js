/**
 * Minimal in-memory mock of the Drizzle query builder.
 *
 * Supports the exact chains used by api/_lib/service-handler.ts:
 *   db.select().from(table).orderBy(...).then(...)
 *   db.select().from(table).where(...).limit(1).then(...)
 *   db.update(table).set(values).where(...).returning().then(...)
 *   db.insert(table).values(values).returning().then(...)
 *   db.delete(table).where(...).then(...)
 *
 * `eq(field, value)` returns { _op: 'eq', field, value } which the mock
 * understands. The handler accepts `eq` and `asc` as dependencies so tests
 * can inject the mock-aware versions.
 */

export function eq(field: string, value: unknown) {
  return { _op: 'eq', field, value };
}

export function asc(field: string) {
  return { _dir: 'asc', field };
}

function fieldName(column: unknown): string {
  // Drizzle column descriptors have a `.name` property.
  if (column && typeof column === 'object' && typeof (column as any).name === 'string') {
    return (column as any).name;
  }
  return String(column ?? '');
}

function whereMatches(row: Record<string, unknown>, where: unknown): boolean {
  if (!where) return true;
  if (where && typeof where === 'object' && (where as any)._op === 'eq') {
    return String(row[(where as any).field] ?? '') === String((where as any).value ?? '');
  }
  return true;
}

export function createMockDb(initialRows: Record<string, unknown>[] = []) {
  const rows = initialRows.map(r => ({ ...r }));
  const calls: Record<string, unknown>[] = [];

  function selectAll() {
    calls.push({ op: 'select' });
    return Promise.resolve([...rows]);
  }

  function selectWhere(where: unknown, limit?: number) {
    calls.push({ op: 'select', where, limit });
    const matched = rows.filter(r => whereMatches(r, where));
    return Promise.resolve(limit != null ? matched.slice(0, limit) : matched);
  }

  function updateWhere(values: Record<string, unknown>, where: unknown) {
    calls.push({ op: 'update', values, where });
    const matched = rows.filter(r => whereMatches(r, where));
    for (const row of matched) Object.assign(row, values);
    return Promise.resolve(matched);
  }

  function insertValues(values: Record<string, unknown> | Record<string, unknown>[]) {
    calls.push({ op: 'insert', values });
    const arr = Array.isArray(values) ? values : [values];
    const inserted: Record<string, unknown>[] = [];
    for (const v of arr) {
      const row = { ...(v) };
      rows.push(row);
      inserted.push(row);
    }
    return Promise.resolve(inserted);
  }

  function deleteWhere(where: unknown) {
    calls.push({ op: 'delete', where });
    const matched = rows.filter(r => whereMatches(r, where));
    for (const row of matched) {
      const idx = rows.indexOf(row);
      if (idx >= 0) rows.splice(idx, 1);
    }
    return Promise.resolve(matched);
  }

  const db = {
    select() {
      return {
        from(_table: unknown) {
          return {
            orderBy(...args: unknown[]) {
              calls.push({ op: 'select', orderBy: args });
              return {
                then: (resolve: (v: Record<string, unknown>[]) => any) => selectAll().then(resolve),
              };
            },
            where(w: unknown) {
              return {
                limit(n?: number) {
                  return {
                    then: (resolve: (v: Record<string, unknown>[]) => any) => selectWhere(w, n).then(resolve),
                  };
                },
                then(resolve: (v: Record<string, unknown>[]) => any) {
                  return selectWhere(w).then(resolve);
                },
              };
            },
            then(resolve: (v: Record<string, unknown>[]) => any) {
              return selectAll().then(resolve);
            },
          };
        },
      };
    },
    update(_table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where(w: unknown) {
              return {
                returning() {
                  return {
                    then: (resolve: (v: Record<string, unknown>[]) => any) => updateWhere(values, w).then(resolve),
                  };
                },
              };
            },
          };
        },
      };
    },
    insert(_table: unknown) {
      return {
        values(values: Record<string, unknown> | Record<string, unknown>[]) {
          return {
            returning() {
              return {
                then: (resolve: (v: Record<string, unknown>[]) => any) => insertValues(values).then(resolve),
              };
            },
          };
        },
      };
    },
    delete(_table: unknown) {
      return {
        where(w: unknown) {
          return {
            then(resolve: (v: Record<string, unknown>[]) => any) {
              return deleteWhere(w).then(resolve);
            },
          };
        },
      };
    },
  };

  return { db, calls, rows };
}