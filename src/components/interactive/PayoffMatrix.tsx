import { useState, useMemo } from 'preact/hooks';
import styles from './PayoffMatrix.module.css';

type Payoffs = number[][][];

interface Props {
  /** Total prize pot, used to derive the default split-or-steal payoffs. */
  pot?: number;
  rowPlayer?: string;
  colPlayer?: string;
  actions?: [string, string];
  /** Override the derived matrix: payoffs[row][col] = [rowPayoff, colPayoff]. */
  payoffs?: Payoffs;
}

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

/** Split-or-steal: only mutual splitting shares the pot; a steal takes it all. */
function splitOrSteal(pot: number): Payoffs {
  return [
    [[pot / 2, pot / 2], [0, pot]],
    [[pot, 0], [0, 0]],
  ];
}

/** A cell is Nash if neither player can improve by unilaterally switching. */
function nashCells(p: Payoffs): boolean[][] {
  return p.map((rowCells, r) =>
    rowCells.map((_, c) => {
      const rowBest = p.every((_, alt) => p[alt][c][0] <= p[r][c][0]);
      const colBest = p[r].every((_, alt) => p[r][alt][1] <= p[r][c][1]);
      return rowBest && colBest;
    }),
  );
}

/** A cell is Pareto optimal if no other cell improves someone without hurting the other. */
function paretoCells(p: Payoffs): boolean[][] {
  const all = p.flatMap((rowCells) => rowCells);
  return p.map((rowCells) =>
    rowCells.map((cell) =>
      !all.some(
        (other) =>
          other[0] >= cell[0] &&
          other[1] >= cell[1] &&
          (other[0] > cell[0] || other[1] > cell[1]),
      ),
    ),
  );
}

export default function PayoffMatrix({
  pot = 100,
  rowPlayer = 'Player A',
  colPlayer = 'Player B',
  actions = ['Split', 'Steal'],
  payoffs,
}: Props) {
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [showNash, setShowNash] = useState(false);
  const [showPareto, setShowPareto] = useState(false);

  const matrix = useMemo(() => payoffs ?? splitOrSteal(pot), [payoffs, pot]);
  const nash = useMemo(() => nashCells(matrix), [matrix]);
  const pareto = useMemo(() => paretoCells(matrix), [matrix]);

  const active = selected ? matrix[selected.row][selected.col] : null;

  return (
    <figure class={styles.wrapper}>
      <div class={styles.grid} role="group" aria-label="Payoff matrix">
        <div class={styles.corner} aria-hidden="true" />
        {actions.map((a) => (
          <div key={a} class={styles.colHeader}>
            <span class={styles.playerName}>{colPlayer}</span>
            {a}
          </div>
        ))}

        {actions.map((rowAction, r) => (
          <>
            <div key={rowAction} class={styles.rowHeader}>
              <span class={styles.playerName}>{rowPlayer}</span>
              {rowAction}
            </div>
            {actions.map((colAction, c) => {
              const isSelected = selected?.row === r && selected?.col === c;
              const classes = [
                styles.cell,
                isSelected && styles.selected,
                showNash && nash[r][c] && styles.nash,
                showPareto && pareto[r][c] && styles.pareto,
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <button
                  key={colAction}
                  type="button"
                  class={classes}
                  aria-pressed={isSelected}
                  aria-label={`${rowPlayer} ${rowAction}, ${colPlayer} ${colAction}`}
                  onMouseEnter={() => setSelected({ row: r, col: c })}
                  onFocus={() => setSelected({ row: r, col: c })}
                  onClick={() => setSelected({ row: r, col: c })}
                >
                  <span class={styles.payoff}>{gbp.format(matrix[r][c][0])}</span>
                  <span class={styles.divider} aria-hidden="true">/</span>
                  <span class={styles.payoff}>{gbp.format(matrix[r][c][1])}</span>
                </button>
              );
            })}
          </>
        ))}
      </div>

      <p class={styles.readout} aria-live="polite">
        {active ? (
          <>
            <strong>{rowPlayer}</strong> takes {gbp.format(active[0])},{' '}
            <strong>{colPlayer}</strong> takes {gbp.format(active[1])}.
          </>
        ) : (
          <span class={styles.hint}>Hover or tap a cell to see who walks away with what.</span>
        )}
      </p>

      <div class={styles.controls}>
        <label class={styles.toggle}>
          <input
            type="checkbox"
            checked={showNash}
            onChange={() => setShowNash((v) => !v)}
          />
          Nash equilibria
        </label>
        <label class={styles.toggle}>
          <input
            type="checkbox"
            checked={showPareto}
            onChange={() => setShowPareto((v) => !v)}
          />
          Pareto optimal
        </label>
      </div>
    </figure>
  );
}
