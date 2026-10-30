import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
type RouterOutputs = inferRouterOutputs<AppRouter>;

type Overview = RouterOutputs["financial"]["overview"];
type Entry = Overview["entries"][number];
type Installment = Entry["installments"][number];
const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (date: string) => date.split("-").reverse().join("/");
const localDay = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date()
  );
const methods = {
  cash: "Dinheiro",
  pix: "Pix",
  bank: "Conta bancária",
  card: "Cartão",
} as const;
const statuses: Record<string, string> = {
  open: "Em aberto",
  partial: "Parcial",
  paid: "Quitada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};
const emptyEntry = () => ({
  requestId: crypto.randomUUID(),
  type: "payable" as "payable" | "receivable",
  description: "",
  person: "",
  category: "",
  document: "",
  issueDate: localDay(),
  firstDueDate: localDay(),
  total: 0,
  installmentCount: 1,
  notes: "",
});
export default function Financial() {
  const utils = trpc.useUtils();
  const overview = trpc.financial.overview.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const [draft, setDraft] = useState(emptyEntry),
    [editing, setEditing] = useState(false),
    [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all"),
    [status, setStatus] = useState("pending"),
    [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{
    entry: Entry;
    installment: Installment;
  }>();
  const [payment, setPayment] = useState({
    principal: 0,
    interest: 0,
    discount: 0,
    method: "bank" as keyof typeof methods,
    note: "",
  });
  const paymentId = useRef(crypto.randomUUID());
  const [action, setAction] = useState<{
      type: "cancel" | "reverse";
      id: number;
    }>(),
    [reason, setReason] = useState("");
  const refresh = () => {
    void utils.financial.invalidate();
    void utils.cash.invalidate();
  };
  const fail = (e: { message: string }) => setMessage(e.message);
  const create = trpc.financial.create.useMutation({
    onError: fail,
    onSuccess: e => {
      setEditing(false);
      setDraft(emptyEntry());
      setMessage(
        `Lançamento #${e.id} criado. O caixa será movimentado somente na baixa.`
      );
      refresh();
    },
  });
  const settle = trpc.financial.settle.useMutation({
    onError: fail,
    onSuccess: () => {
      setSelected(undefined);
      setMessage("Baixa registrada no financeiro e no caixa.");
      refresh();
    },
  });
  const cancel = trpc.financial.cancel.useMutation({
    onError: fail,
    onSuccess: () => {
      setAction(undefined);
      setMessage("Lançamento cancelado.");
      refresh();
    },
  });
  const reverse = trpc.financial.reverse.useMutation({
    onError: fail,
    onSuccess: () => {
      setAction(undefined);
      setMessage(
        "Baixa estornada. O caixa recebeu a contrapartida e a parcela voltou a ficar em aberto."
      );
      refresh();
    },
  });
  const rows = (overview.data?.entries ?? [])
    .flatMap(entry =>
      entry.installments.map(installment => ({ entry, installment }))
    )
    .filter(
      ({ entry, installment }) =>
        (filter === "all" || entry.type === filter) &&
        (status === "all" ||
          (status === "pending"
            ? !["paid", "cancelled"].includes(installment.status)
            : installment.status === status)) &&
        `${entry.description} ${entry.person} ${entry.document} ${entry.category}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR"))
    );
  return (
    <section className="erp-page backoffice-page">
      <span className="eyebrow">FINANCEIRO / COMPROMISSOS</span>
      <div className="purchase-toolbar">
        <div>
          <h1>A pagar e receber.</h1>
          <p>
            Organize vencimentos, registre baixas parciais e acompanhe o que
            falta pagar ou receber.
          </p>
        </div>
        <button
          onClick={() => {
            setDraft(emptyEntry());
            setMessage("");
            create.reset();
            setEditing(true);
          }}
        >
          Novo lançamento
        </button>
      </div>
      <div className="production-summary">
        {[
          ["A pagar", overview.data?.totals.payableCents ?? 0],
          ["A receber", overview.data?.totals.receivableCents ?? 0],
          [
            "Vencido (pagar + receber)",
            overview.data?.totals.overdueCents ?? 0,
          ],
        ].map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <h2>{money(Number(value))}</h2>
          </article>
        ))}
      </div>
      <p className="backoffice-notice">
        Cadastre compromissos aqui; use Fluxo de caixa para movimentos
        imediatos. Compras e vendas não criam estes títulos automaticamente
        nesta versão. A baixa registra uma confirmação manual de pagamento, sem
        executar transferência bancária.
      </p>
      {message && <p role="status">{message}</p>}
      {overview.error && <p role="alert">{overview.error.message}</p>}
      <div className="backoffice-filters">
        <label>
          Buscar
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pessoa, descrição, categoria ou documento"
          />
        </label>
        <label>
          Tipo
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="payable">A pagar</option>
            <option value="receivable">A receber</option>
          </select>
        </label>
        <label>
          Situação
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="pending">Pendentes</option>
            <option value="all">Todas</option>
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="panel backoffice-card backoffice-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lançamento / pessoa</th>
              <th>Categoria</th>
              <th>Parcela / vencimento</th>
              <th>Valor</th>
              <th>Saldo</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, installment: i }) => (
              <tr key={`${entry.id}:${i.number}`}>
                <td>
                  <strong>
                    {entry.type === "payable" ? "A pagar" : "A receber"} ·{" "}
                    {entry.description}
                  </strong>
                  <p>
                    {entry.person} {entry.document && `· ${entry.document}`}
                  </p>
                  {entry.notes && <small>{entry.notes}</small>}
                </td>
                <td>{entry.category}</td>
                <td>
                  {i.number}/{entry.installments.length}
                  <p>{dateLabel(i.dueDate)}</p>
                </td>
                <td>{money(i.amountCents)}</td>
                <td>{money(i.remainingCents)}</td>
                <td>
                  <span
                    className={
                      i.status === "overdue" ? "backoffice-danger" : ""
                    }
                  >
                    {statuses[i.status]}
                  </span>
                </td>
                <td>
                  {!entry.cancelledAt && i.remainingCents > 0 && (
                    <button
                      onClick={() => {
                        setSelected({ entry, installment: i });
                        setPayment({
                          principal: i.remainingCents / 100,
                          interest: 0,
                          discount: 0,
                          method: "bank",
                          note: "",
                        });
                        paymentId.current = crypto.randomUUID();
                        setMessage("");
                        settle.reset();
                      }}
                    >
                      Registrar baixa
                    </button>
                  )}
                  {!entry.cancelledAt && (
                    <button
                      onClick={() => {
                        setAction({ type: "cancel", id: entry.id });
                        setReason("");
                        setMessage("");
                      }}
                    >
                      Cancelar título
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {overview.isLoading ? (
          <p>Carregando…</p>
        ) : (
          !rows.length && <p>Nenhuma parcela para os filtros selecionados.</p>
        )}
      </div>
      <section className="panel backoffice-card">
        <h2>Histórico de baixas</h2>
        <div className="backoffice-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Lançamento</th>
                <th>Principal</th>
                <th>Juros / desconto</th>
                <th>Valor no caixa</th>
                <th>Meio</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {overview.data?.settlements.map(s => (
                <tr key={s.id}>
                  <td>
                    {new Date(s.createdAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </td>
                  <td>
                    #{s.entryId} · parcela {s.installment}
                    {s.note && <p>{s.note}</p>}
                  </td>
                  <td>{money(s.principalCents)}</td>
                  <td>
                    +{money(s.interestCents)} / −{money(s.discountCents)}
                  </td>
                  <td>{money(s.cashCents)}</td>
                  <td>{methods[s.method]}</td>
                  <td>
                    {s.reversedAt ? (
                      <span>
                        Estornada<p>{s.reversalReason}</p>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setAction({ type: "reverse", id: s.id });
                          setReason("");
                          setMessage("");
                        }}
                      >
                        Estornar baixa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!overview.data?.settlements.length && (
            <p>Nenhuma baixa registrada.</p>
          )}
        </div>
      </section>
      <Dialog
        open={editing}
        onOpenChange={open => {
          if (!create.isPending) setEditing(open);
        }}
      >
        <DialogContent className="inventory-dialog">
          <DialogHeader>
            <DialogTitle>Novo lançamento financeiro</DialogTitle>
            <DialogDescription>
              O total será dividido em parcelas mensais. Os centavos restantes
              ficam nas primeiras parcelas.
            </DialogDescription>
          </DialogHeader>
          <form
            className="erp-form"
            onSubmit={e => {
              e.preventDefault();
              setMessage("");
              create.mutate(draft);
            }}
          >
            <label>
              Tipo
              <select
                value={draft.type}
                onChange={e =>
                  setDraft({
                    ...draft,
                    type: e.target.value as typeof draft.type,
                  })
                }
              >
                <option value="payable">A pagar</option>
                <option value="receivable">A receber</option>
              </select>
            </label>
            <label>
              Descrição
              <input
                required
                minLength={3}
                maxLength={300}
                value={draft.description}
                onChange={e =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <label>
              Pessoa / fornecedor
              <input
                required
                minLength={2}
                maxLength={160}
                value={draft.person}
                onChange={e => setDraft({ ...draft, person: e.target.value })}
              />
            </label>
            <label>
              Categoria
              <input
                required
                minLength={2}
                maxLength={100}
                placeholder="Ex.: compra de insumos"
                value={draft.category}
                onChange={e => setDraft({ ...draft, category: e.target.value })}
              />
            </label>
            <div className="editor-row">
              <label>
                Data do lançamento
                <input
                  required
                  type="date"
                  value={draft.issueDate}
                  onChange={e =>
                    setDraft({ ...draft, issueDate: e.target.value })
                  }
                />
              </label>
              <label>
                Primeiro vencimento
                <input
                  required
                  type="date"
                  value={draft.firstDueDate}
                  onChange={e =>
                    setDraft({ ...draft, firstDueDate: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="editor-row">
              <label>
                Valor total (R$)
                <input
                  required
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  value={draft.total || ""}
                  onChange={e =>
                    setDraft({ ...draft, total: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Parcelas mensais
                <input
                  required
                  type="number"
                  min="1"
                  max="60"
                  step="1"
                  value={draft.installmentCount}
                  onChange={e =>
                    setDraft({
                      ...draft,
                      installmentCount: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <label>
              Documento (opcional)
              <input
                maxLength={100}
                value={draft.document}
                onChange={e => setDraft({ ...draft, document: e.target.value })}
              />
            </label>
            <label>
              Observações
              <textarea
                maxLength={2000}
                value={draft.notes}
                onChange={e => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
            {create.error && <p role="alert">{create.error.message}</p>}
            <button disabled={create.isPending}>
              {create.isPending ? "Salvando…" : "Criar lançamento"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={open => {
          if (!open && !settle.isPending) setSelected(undefined);
        }}
      >
        <DialogContent className="inventory-dialog">
          <DialogHeader>
            <DialogTitle>
              Registrar baixa{" "}
              {selected?.entry.type === "payable"
                ? "de pagamento"
                : "de recebimento"}
            </DialogTitle>
            <DialogDescription>
              {selected?.entry.description} · saldo{" "}
              {money(selected?.installment.remainingCents ?? 0)}. Confirme
              apenas um valor já pago ou recebido.
            </DialogDescription>
          </DialogHeader>
          <form
            className="erp-form"
            onSubmit={e => {
              e.preventDefault();
              if (selected)
                settle.mutate({
                  ...payment,
                  requestId: paymentId.current,
                  entryId: selected.entry.id,
                  installment: selected.installment.number,
                });
            }}
          >
            <label>
              Principal a quitar (R$)
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                max={(selected?.installment.remainingCents ?? 0) / 100}
                value={payment.principal}
                onChange={e =>
                  setPayment({ ...payment, principal: Number(e.target.value) })
                }
              />
            </label>
            <div className="editor-row">
              <label>
                Juros (R$)
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={payment.interest}
                  onChange={e =>
                    setPayment({ ...payment, interest: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Desconto (R$)
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={payment.discount}
                  onChange={e =>
                    setPayment({ ...payment, discount: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <p>
              Valor efetivo no caixa:{" "}
              <strong>
                {money(
                  Math.round(payment.principal * 100) +
                    Math.round(payment.interest * 100) -
                    Math.round(payment.discount * 100)
                )}
              </strong>
            </p>
            <label>
              Meio
              <select
                value={payment.method}
                onChange={e =>
                  setPayment({
                    ...payment,
                    method: e.target.value as typeof payment.method,
                  })
                }
              >
                {Object.entries(methods).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Observação
              <input
                maxLength={500}
                value={payment.note}
                onChange={e => setPayment({ ...payment, note: e.target.value })}
              />
            </label>
            {settle.error && <p role="alert">{settle.error.message}</p>}
            <button disabled={settle.isPending}>
              {settle.isPending
                ? "Registrando…"
                : "Confirmar baixa e movimentar caixa"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!action}
        onOpenChange={open => {
          if (!open && !cancel.isPending && !reverse.isPending)
            setAction(undefined);
        }}
      >
        <DialogContent className="inventory-dialog">
          <DialogHeader>
            <DialogTitle>
              {action?.type === "reverse"
                ? "Estornar baixa"
                : "Cancelar lançamento"}
            </DialogTitle>
            <DialogDescription>
              {action?.type === "reverse"
                ? "O estorno gera a contrapartida no caixa e reabre o saldo da parcela."
                : "O cancelamento preserva o histórico. Estorne primeiro as baixas existentes."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="erp-form"
            onSubmit={e => {
              e.preventDefault();
              if (action)
                (action.type === "reverse" ? reverse : cancel).mutate({
                  id: action.id,
                  reason,
                });
            }}
          >
            <label>
              Motivo
              <input
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </label>
            {message && <p role="alert">{message}</p>}
            <button disabled={cancel.isPending || reverse.isPending}>
              Confirmar{" "}
              {action?.type === "reverse" ? "estorno" : "cancelamento"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
