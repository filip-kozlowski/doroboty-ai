import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Link } from "react-router";
import { Tabs } from "@base-ui/react/tabs";
import { FileText, GripVertical, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { ProcessTimeline } from "@/components/process-timeline";
import { CvAttachment } from "./cv-attachment";
import taskResults from "./data/task-results.json" with { type: "json" };
import { nextStages, stageLabels, type Application, type InterviewQuestion } from "./model";
import { usePrototype } from "./store";

// Mock task results: in experiment E1 the task is sent and returned by e-mail outside
// the portal (concierge), so the recruiter only sees the result and the prepared questions.
type Level = "strong" | "partial" | "weak";
type Prepared = {
  task: {
    title: string;
    sentAt: string;
    returnedAt: string;
    minutes: number;
    tools: string[];
    improved: string;
    verification: string;
    brief: string[];
    rules: string[];
    attachment: string;
  };
  evaluation: {
    summary: string;
    criteria: { criterion: string; level: Level; comment: string }[];
    evaluatedBy: string;
  };
  claims: string[];
  shown: string[];
  unknown: string[];
  questions: InterviewQuestion[];
};
const prepared = taskResults as Record<string, Prepared | undefined>;

const day = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" });
const fullDay = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" });
const clock = new Intl.DateTimeFormat("pl-PL", { timeStyle: "short" });
const MAX_QUESTIONS = 10;
const levelLabels: Record<Level, string> = { strong: "Mocno", partial: "Częściowo", weak: "Słabo" };
const verdictLabels: Record<InterviewQuestion["verdict"], string> = {
  open: "Jeszcze nie wiem",
  confirmed: "Potwierdza",
  doubtful: "Podważa",
};

export function RecruiterProfile({ application }: { application: Application }) {
  const { state, run, error } = usePrototype();
  const person = state.people.find((item) => item.id === application.candidateId);
  const sheet = prepared[application.id];
  const questions = application.briefing?.questions ?? sheet?.questions ?? [];
  const submitted = application.events[0];

  const [tab, setTab] = useState<string>("summary");
  const [announcement, setAnnouncement] = useState("");
  const [saved, setSaved] = useState("");
  const [removed, setRemoved] = useState<{ question: InterviewQuestion; index: number } | null>(
    null,
  );
  const [adding, setAdding] = useState(false);
  const statusRef = useRef<HTMLSpanElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const pendingFocus = useRef(false);
  const itemRefs = useRef(new Map<string, HTMLLIElement | null>());
  const handleRefs = useRef(new Map<string, HTMLButtonElement | null>());
  // Preview order while a question is dragged (pointer) or picked up (keyboard).
  const [order, setOrder] = useState<string[] | null>(null);
  const orderRef = useRef<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const availableStages = nextStages[application.stage];

  useLayoutEffect(() => {
    if (pendingFocus.current) {
      statusRef.current?.focus();
      pendingFocus.current = false;
    }
  }, [application.stage]);

  function saveQuestions(next: InterviewQuestion[], message: string) {
    if (run({ type: "briefing", applicationId: application.id, questions: next })) {
      setSaved(`${message} Zapisano w tej przeglądarce o ${clock.format(new Date())}.`);
      return true;
    }
    return false;
  }

  const byId = new Map(questions.map((item) => [item.id, item]));
  const shown = order
    ? order.map((id) => byId.get(id)).filter((item): item is InterviewQuestion => !!item)
    : questions;

  function preview(next: string[] | null) {
    orderRef.current = next;
    setOrder(next);
  }
  function focusHandle(id: string) {
    requestAnimationFrame(() => handleRefs.current.get(id)?.focus());
  }
  function finishMove(id: string, commit: boolean) {
    const ids = orderRef.current;
    preview(null);
    setDragId(null);
    setGrabbedId(null);
    if (!commit || !ids) return;
    const from = questions.findIndex((item) => item.id === id);
    const to = ids.indexOf(id);
    if (from === to) return;
    const next = ids
      .map((key) => byId.get(key))
      .filter((item): item is InterviewQuestion => !!item);
    if (saveQuestions(next, `Pytanie przeniesione na miejsce ${to + 1}.`)) setRemoved(null);
  }
  function startPointerDrag(id: string, event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    setDragId(id);
    preview(questions.map((item) => item.id));
    // Window listeners: React moves the dragged node, which would drop pointer capture.
    const move = (moveEvent: globalThis.PointerEvent) => {
      const current = orderRef.current;
      if (!current) return;
      const others = current.filter((key) => key !== id);
      let target = 0;
      for (const key of others) {
        const rect = itemRefs.current.get(key)?.getBoundingClientRect();
        if (rect && moveEvent.clientY > rect.top + rect.height / 2) target++;
      }
      const next = [...others];
      next.splice(target, 0, id);
      if (next.join() !== current.join()) preview(next);
    };
    const end = (endEvent: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      finishMove(id, endEvent.type === "pointerup");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }
  function handleKey(id: string, event: KeyboardEvent<HTMLButtonElement>) {
    const current = orderRef.current;
    const pick = event.key === " " || event.key === "Enter";
    if (grabbedId !== id) {
      if (!pick) return;
      event.preventDefault();
      setGrabbedId(id);
      preview(questions.map((item) => item.id));
      setAnnouncement(
        "Pytanie podniesione. Strzałkami w górę i w dół zmień miejsce, Enter albo spacja upuszcza, Escape anuluje.",
      );
      return;
    }
    if (!current) return;
    if (pick) {
      event.preventDefault();
      setAnnouncement(`Pytanie upuszczone na miejscu ${current.indexOf(id) + 1}.`);
      finishMove(id, true);
      focusHandle(id);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setAnnouncement("Przenoszenie anulowane.");
      finishMove(id, false);
      focusHandle(id);
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const from = current.indexOf(id);
      const to = from + (event.key === "ArrowUp" ? -1 : 1);
      if (to < 0 || to >= current.length) return;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, id);
      preview(next);
      setAnnouncement(`Miejsce ${to + 1} z ${next.length}.`);
      focusHandle(id);
    }
  }

  return (
    <article className="lav recruiting-record">
      <header className="lav-hero">
        <div>
          <nav aria-label="Ścieżka nawigacji" className="lav-crumb">
            <Link to="/app/kandydaci">Kandydaci</Link>
            <span aria-hidden="true"> / </span>
            <span>{application.jobTitle}</span>
          </nav>
          <h1>{application.candidateName}</h1>
          {person && (
            <p className="lav-sub">
              {person.headline} · {person.location}
            </p>
          )}
          <div className="lav-chips record-meta">
            <span className="lav-chip lav-chip-stage record-stage" tabIndex={-1} ref={statusRef}>
              {stageLabels[application.stage]}
            </span>
            {sheet && (
              <button
                type="button"
                className="lav-chip lav-chip-ok lav-chip-button"
                onClick={() => {
                  setTab("task");
                  tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Zadanie oddane · zobacz
              </button>
            )}
            <span className="lav-chip">Match Score: {application.score}%</span>
            {submitted && (
              <span className="lav-chip">
                Aplikacja z{" "}
                <time dateTime={submitted.at}>{fullDay.format(new Date(submitted.at))}</time>
              </span>
            )}
          </div>
        </div>
        <img
          className="lav-hero-art"
          src={`${import.meta.env.BASE_URL}illustrations/robot-robotnik-macha-skrzynka.webp`}
          width={150}
          height={177}
          alt="Plastelinowy robot-robotnik w żółtym kasku macha ręką i trzyma skrzynkę na narzędzia"
        />
      </header>

      <div className="lav-grid">
        <div className="lav-main">
          <section className="lav-materials" aria-labelledby="materials-heading" ref={tabsRef}>
            <h2 id="materials-heading" className="sr-only">
              Materiały kandydata
            </h2>
            <Tabs.Root value={tab} onValueChange={(value) => setTab(String(value))}>
              <Tabs.List className="lav-tabs" aria-label="Materiały kandydata" activateOnFocus>
                <Tabs.Tab value="summary" className="lav-tab">
                  Podsumowanie
                </Tabs.Tab>
                <Tabs.Tab value="cv" className="lav-tab">
                  CV
                </Tabs.Tab>
                <Tabs.Tab value="task" className="lav-tab">
                  Zadanie
                </Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="summary" className="lav-tab-panel">
                <SummaryTab application={application} sheet={sheet} />
              </Tabs.Panel>
              <Tabs.Panel value="cv" className="lav-tab-panel">
                <h3 className="lav-eyebrow">CV z momentu aplikowania</h3>
                <CvAttachment
                  candidateId={application.candidateId}
                  fallbackText={application.cv}
                  layout="row"
                  preview
                />
              </Tabs.Panel>
              <Tabs.Panel value="task" className="lav-tab-panel">
                <TaskTab sheet={sheet} />
              </Tabs.Panel>
            </Tabs.Root>
          </section>

          <section className="lav-sec lav-sheet" aria-labelledby="sheet-heading">
            <span className="lav-chip lav-chip-cat">Ściągawka do rozmowy</span>
            <h2 id="sheet-heading">Notatka rekrutacyjna</h2>
            <p className="lav-lead">
              {sheet
                ? "Pytania przygotowaliśmy z wyniku zadania. Zmieniaj je, dodawaj własne i ustaw kolejność, w jakiej chcesz pytać. Odpowiedzi notuj przy pytaniach."
                : "Dopisz pytania, które chcesz zadać w rozmowie, i notuj przy nich odpowiedzi."}
            </p>
            {questions.length > 0 && (
              <ol
                className="lav-questions"
                aria-label="Pytania do rozmowy"
                data-dragging={dragId ? "" : undefined}
              >
                {shown.map((question, index) => (
                  <QuestionItem
                    key={question.id}
                    index={index}
                    question={question}
                    moving={dragId === question.id || grabbedId === question.id}
                    itemRef={(element) => itemRefs.current.set(question.id, element)}
                    handle={{
                      ref: (element) => {
                        handleRefs.current.set(question.id, element);
                      },
                      onPointerDown: (event) => startPointerDrag(question.id, event),
                      onKeyDown: (event) => handleKey(question.id, event),
                      onBlur: () => {
                        if (grabbedId !== question.id) return;
                        setTimeout(() => {
                          if (document.activeElement !== handleRefs.current.get(question.id))
                            finishMove(question.id, false);
                        });
                      },
                    }}
                    onSave={(value, message) =>
                      saveQuestions(
                        questions.map((item) => (item.id === value.id ? value : item)),
                        message,
                      )
                    }
                    onRemove={() => {
                      if (
                        saveQuestions(
                          questions.filter((item) => item.id !== question.id),
                          `Usunięto pytanie ${index + 1}.`,
                        )
                      )
                        setRemoved({ question, index });
                    }}
                  />
                ))}
              </ol>
            )}
            {adding ? (
              <div className="lav-new-question">
                <QuestionEditor
                  heading="Nowe pytanie"
                  initial={{ question: "", strong: "", weak: "" }}
                  onCancel={() => setAdding(false)}
                  onSave={(value) => {
                    if (
                      saveQuestions(
                        [
                          ...questions,
                          { id: crypto.randomUUID(), verdict: "open", note: "", ...value },
                        ],
                        "Dodano pytanie.",
                      )
                    )
                      setAdding(false);
                  }}
                />
              </div>
            ) : questions.length < MAX_QUESTIONS ? (
              <button type="button" className="lav-link-button" onClick={() => setAdding(true)}>
                + Dodaj pytanie
              </button>
            ) : (
              <p className="lav-hint">Możesz mieć najwyżej {MAX_QUESTIONS} pytań.</p>
            )}
            <p className="lav-saved" role="status">
              {saved}
              {removed && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="lav-link-button"
                    onClick={() => {
                      const next = [...questions];
                      next.splice(removed.index, 0, removed.question);
                      if (saveQuestions(next, "Przywrócono pytanie.")) setRemoved(null);
                    }}
                  >
                    Cofnij
                  </button>
                </>
              )}
            </p>
            {error && (
              <p className="lav-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>

        <aside className="lav-side" aria-label="Decyzja i historia">
          <section className="lav-card" aria-labelledby="decision-heading">
            <h2 id="decision-heading" className="lav-card-title">
              Następny krok
            </h2>
            {availableStages.length > 0 ? (
              <>
                <p className="lav-hint lav-hint-top">
                  Zmiana etapu zapisze się w historii procesu. Kandydat widzi tylko etap.
                </p>
                <div className="lav-actions record-actions">
                  {availableStages.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      className={
                        stage === "rejected"
                          ? "lav-btn lav-btn-secondary"
                          : "lav-btn lav-btn-primary"
                      }
                      onClick={() => {
                        if (
                          run({ type: "stage", applicationId: application.id, stage, note: "" })
                        ) {
                          setAnnouncement(`Zapisano etap: ${stageLabels[stage]}.`);
                          pendingFocus.current = true;
                        }
                      }}
                    >
                      {stageLabels[stage]}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="lav-hint">
                {stageLabels[application.stage]}. Brak kolejnych działań w tym procesie.
              </p>
            )}
          </section>

          <div className="lav-notes">
            <section className="lav-note" aria-labelledby="score-heading">
              <h2 id="score-heading">Match Score {application.score}%</h2>
              <p>
                Porównuje teksty ogłoszenia, profilu i odpowiedzi. To wskazówka, nie wyrok, i na
                pewno nie test umiejętności.
              </p>
            </section>
            <section className="lav-note" aria-labelledby="process-heading">
              <h2 id="process-heading">Historia procesu</h2>
              <ProcessTimeline
                items={application.events.map((event, index) => ({
                  id: `${index}-${event.at}`,
                  title: stageLabels[event.stage],
                  dateTime: event.at,
                  content: event.note || undefined,
                }))}
              />
            </section>
          </div>
        </aside>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </article>
  );
}

function SummaryTab({ application, sheet }: { application: Application; sheet?: Prepared }) {
  return (
    <>
      <h3 className="lav-eyebrow">Podsumowanie aplikacji</h3>
      <p className="lav-lead lav-summary">{application.summary}</p>
      {sheet && (
        <div className="lav-facts">
          <FactList title="Deklaruje w aplikacji" items={sheet.claims} />
          <FactList title="Pokazało zadanie" items={sheet.shown} />
          <FactList title="Czego nie wiemy" items={sheet.unknown} />
        </div>
      )}
      <h3 className="lav-eyebrow lav-gap">Przesłana aplikacja</h3>
      <p className="lav-answer">{application.answer}</p>
    </>
  );
}

function TaskTab({ sheet }: { sheet?: Prepared }) {
  if (!sheet)
    return (
      <div className="lav-empty">
        <h3>Wyniku zadania jeszcze nie ma</h3>
        <p>
          Zadanie wysyłamy mailem osobom z krótkiej listy. Gdy kandydat je odeśle, zobaczysz tu
          treść zadania, ocenę i jego rozwiązanie.
        </p>
      </div>
    );
  const { task, evaluation } = sheet;
  const href = `${import.meta.env.BASE_URL}task/${task.attachment}`;
  return (
    <>
      <p className="lav-task-meta">
        Zadanie z dozwolonym AI · wysłane mailem{" "}
        <time dateTime={task.sentAt}>{day.format(new Date(task.sentAt))}</time>, odesłane{" "}
        <time dateTime={task.returnedAt}>{day.format(new Date(task.returnedAt))}</time> ·{" "}
        <span className="lav-num">{task.minutes} min</span> według kandydata
      </p>

      <div className="lav-block">
        <h3 className="lav-h3">O co prosiliśmy</h3>
        {task.brief.map((line) => (
          <p key={line} className="lav-brief">
            {line}
          </p>
        ))}
        <ul className="lav-rules">
          {task.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>

      <section className="lav-panel" aria-labelledby="evaluation-heading">
        <p className="lav-eyebrow">Ocena · {evaluation.evaluatedBy}</p>
        <h3 id="evaluation-heading" className="lav-panel-title">
          Jak poszło
        </h3>
        <p className="lav-panel-lead">{evaluation.summary}</p>
        <ul className="lav-criteria">
          {evaluation.criteria.map((item) => (
            <li key={item.criterion}>
              <div className="lav-criterion-head">
                <span>{item.criterion}</span>
                <span className="lav-chip" data-level={item.level}>
                  {levelLabels[item.level]}
                </span>
              </div>
              <p>{item.comment}</p>
            </li>
          ))}
        </ul>
        <p className="lav-footnote">
          Kandydat mógł korzystać z AI. Ocena mówi, jak z nim pracuje, a nie że wszystko zrobił sam.
          Umiejętności potwierdzasz w rozmowie.
        </p>
      </section>

      <div className="lav-block">
        <h3 className="lav-h3">Odpowiedź kandydata</h3>
        <dl className="lav-answer-facts">
          <div>
            <dt>Narzędzia AI</dt>
            <dd>{task.tools.join(", ")}</dd>
          </div>
          <div>
            <dt>Co poprawił po AI</dt>
            <dd>{task.improved}</dd>
          </div>
          <div>
            <dt>Jak sprawdził wynik</dt>
            <dd>{task.verification}</dd>
          </div>
        </dl>
        <div className="lav-file">
          <FileText aria-hidden="true" size={22} />
          <div className="lav-file-text">
            <strong>{task.attachment}</strong>
            <span>Rozwiązanie z zapisem rozmowy z AI · PDF · przykład</span>
          </div>
          <div className="lav-file-actions">
            <a href={href} target="_blank" rel="noopener noreferrer">
              Otwórz<span className="sr-only"> rozwiązanie zadania (PDF) w nowej karcie</span>
            </a>
            <a href={href} download={task.attachment}>
              Pobierz<span className="sr-only"> rozwiązanie zadania (PDF)</span>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function FactList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

type QuestionText = Pick<InterviewQuestion, "question" | "strong" | "weak">;

type HandleProps = {
  ref: (element: HTMLButtonElement | null) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onBlur: () => void;
};

function QuestionItem({
  question,
  index,
  moving,
  itemRef,
  handle,
  onSave,
  onRemove,
}: {
  question: InterviewQuestion;
  index: number;
  moving: boolean;
  itemRef: (element: HTMLLIElement | null) => void;
  handle: HandleProps;
  onSave: (value: InterviewQuestion, message: string) => boolean;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(question.note);
  const id = useId();
  const number = index + 1;

  if (editing)
    return (
      <li className="lav-question" ref={itemRef}>
        <QuestionEditor
          heading={`Edycja pytania ${number}`}
          initial={question}
          onCancel={() => setEditing(false)}
          onSave={(value) => {
            if (onSave({ ...question, ...value }, `Zmieniono pytanie ${number}.`))
              setEditing(false);
          }}
        />
      </li>
    );

  return (
    <li className="lav-question" ref={itemRef} data-moving={moving ? "" : undefined}>
      <button
        type="button"
        className="lav-drag-handle"
        aria-label={`Przeciągnij pytanie ${number}, aby zmienić kolejność`}
        aria-pressed={moving}
        title="Przeciągnij, aby zmienić kolejność"
        {...handle}
      >
        <GripVertical aria-hidden="true" size={18} />
      </button>
      <div className="lav-question-head">
        <p className="lav-question-text" id={`${id}-q`}>
          {question.question}
        </p>
        <div className="lav-question-tools">
          <button
            type="button"
            className="lav-icon-button"
            aria-label={`Edytuj pytanie ${number}`}
            title="Edytuj"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden="true" size={15} />
          </button>
          <button
            type="button"
            className="lav-icon-button lav-icon-danger"
            aria-label={`Usuń pytanie ${number}`}
            title="Usuń"
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" size={15} />
          </button>
        </div>
      </div>
      {(question.strong || question.weak) && (
        <dl className="lav-listen">
          {question.strong && (
            <div data-kind="strong">
              <dt>
                <span className="lav-sign" aria-hidden="true">
                  <Plus size={12} strokeWidth={3} />
                </span>
                Mocna odpowiedź
              </dt>
              <dd>{question.strong}</dd>
            </div>
          )}
          {question.weak && (
            <div data-kind="weak">
              <dt>
                <span className="lav-sign" aria-hidden="true">
                  <Minus size={12} strokeWidth={3} />
                </span>
                Słaba odpowiedź
              </dt>
              <dd>{question.weak}</dd>
            </div>
          )}
        </dl>
      )}
      <label className="lav-label" htmlFor={`${id}-note`}>
        Notatka do pytania {number}
      </label>
      <textarea
        id={`${id}-note`}
        className="lav-textarea"
        rows={2}
        maxLength={12000}
        value={note}
        placeholder="Co odpowiedział kandydat?"
        onChange={(event) => setNote(event.target.value)}
        onBlur={() => {
          if (note.trim() !== question.note)
            onSave({ ...question, note: note.trim() }, `Zapisano notatkę do pytania ${number}.`);
        }}
      />
      <fieldset className="lav-verdict" aria-describedby={`${id}-q`}>
        <legend>Czy odpowiedź potwierdza umiejętność?</legend>
        <div className="lav-segments">
          {(["confirmed", "doubtful", "open"] as const).map((verdict) => (
            <label key={verdict} className="lav-segment" data-verdict={verdict}>
              <input
                type="radio"
                name={`${id}-verdict`}
                value={verdict}
                checked={question.verdict === verdict}
                onChange={() =>
                  onSave(
                    { ...question, verdict },
                    `Pytanie ${number}: ${verdictLabels[verdict].toLowerCase()}.`,
                  )
                }
              />
              {verdictLabels[verdict]}
            </label>
          ))}
        </div>
      </fieldset>
    </li>
  );
}

function QuestionEditor({
  heading,
  initial,
  onSave,
  onCancel,
}: {
  heading: string;
  initial: QuestionText;
  onSave: (value: QuestionText) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<QuestionText>({
    question: initial.question,
    strong: initial.strong,
    weak: initial.weak,
  });
  const [missing, setMissing] = useState(false);
  const id = useId();
  const field = (key: keyof QuestionText, label: string, hint?: string) => (
    <div className="lav-field">
      <label className="lav-label" htmlFor={`${id}-${key}`}>
        {label}
      </label>
      <textarea
        id={`${id}-${key}`}
        className="lav-textarea"
        rows={2}
        maxLength={1000}
        value={value[key]}
        autoFocus={key === "question"}
        aria-invalid={key === "question" && missing ? true : undefined}
        aria-describedby={hint ? `${id}-${key}-hint` : undefined}
        onChange={(event) => setValue({ ...value, [key]: event.target.value })}
      />
      {hint && (
        <p className="lav-hint" id={`${id}-${key}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
  return (
    <form
      className="lav-editor"
      aria-label={heading}
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.question.trim()) {
          setMissing(true);
          return;
        }
        onSave({
          question: value.question.trim(),
          strong: value.strong.trim(),
          weak: value.weak.trim(),
        });
      }}
    >
      <p className="lav-eyebrow">{heading}</p>
      {field("question", "Pytanie")}
      {missing && (
        <p className="lav-error" role="alert">
          Wpisz treść pytania.
        </p>
      )}
      {field(
        "strong",
        "Mocna odpowiedź (opcjonalnie)",
        "Czego słuchać, żeby uznać umiejętność za potwierdzoną.",
      )}
      {field("weak", "Słaba odpowiedź (opcjonalnie)")}
      <div className="lav-actions lav-actions-row">
        <button type="submit" className="lav-btn lav-btn-primary">
          Zapisz pytanie
        </button>
        <button type="button" className="lav-btn lav-btn-secondary" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </form>
  );
}
