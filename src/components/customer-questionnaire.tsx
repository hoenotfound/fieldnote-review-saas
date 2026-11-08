"use client";
import { useEffect, useState } from "react";
import {
  aspects,
  sentiments,
  questionnaireCopy,
  itemLabel,
  type Answers,
  type QuestionnaireConfig,
} from "@/lib/questionnaire";
import { customerCopy } from "@/lib/customer-copy";
import type { Locale } from "@/lib/i18n";

export function CustomerQuestionnaire({
  answers,
  config,
  locale,
  busy,
  onChange,
}: {
  answers: Answers;
  config: QuestionnaireConfig;
  locale: Locale;
  busy: boolean;
  onChange: (answers: Answers) => void;
}) {
  const q = questionnaireCopy[locale];
  const c = customerCopy[locale];
  const [spendText, setSpendText] = useState(
    answers.spend === null ? "" : String(answers.spend),
  );
  useEffect(() => {
    setSpendText((old) =>
      answers.spend === null
        ? ""
        : Number(old) === answers.spend && old !== ""
          ? old
          : String(answers.spend),
    );
  }, [answers.spend]);
  return (
    <section className="questionnaire" aria-label={q.heading}>
      {config.items.length > 0 && (
        <fieldset disabled={busy} className="question-group">
          <legend>{q.items}</legend>
          <p>{q.itemsHint}</p>
          <div className="answer-choices">
            {config.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="answer-choice"
                aria-pressed={answers.items.includes(item.id)}
                onClick={() =>
                  onChange({
                    ...answers,
                    items: answers.items.includes(item.id)
                      ? answers.items.filter((id) => id !== item.id)
                      : [...answers.items, item.id],
                  })
                }
              >
                {itemLabel(item, locale)}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="question-group">
        <h3>{q.feedback}</h3>
        <p>{q.feedbackHint}</p>
        {aspects.map((aspect) => (
          <fieldset key={aspect} disabled={busy} className="aspect-row">
            <legend>{q[aspect]}</legend>
            <div className="answer-choices">
              {sentiments.map((sentiment) => (
                <button
                  key={sentiment}
                  type="button"
                  className="answer-choice"
                  aria-pressed={answers.ratings[aspect] === sentiment}
                  onClick={() => {
                    const ratings = { ...answers.ratings };
                    if (ratings[aspect] === sentiment) delete ratings[aspect];
                    else ratings[aspect] = sentiment;
                    onChange({ ...answers, ratings });
                  }}
                >
                  {q[sentiment]}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {!!config.feedback?.length && (
        <fieldset className="question-group detail-choices" disabled={busy}>
          <legend>{c.details}</legend>
          <p>{c.detailsHint}</p>
          {config.feedback.map((pair) => (
            <div key={pair.id} className="feedback-pair">
              {(["positive", "negative"] as const).map((side) => {
                const key = pair.id + ":" + side;
                return (
                  <button
                    type="button"
                    key={key}
                    className="answer-choice"
                    aria-pressed={answers.details?.includes(key) || false}
                    onClick={() => {
                      const remaining = (answers.details || []).filter(
                        (id) => id.split(":")[0] !== pair.id,
                      );
                      onChange({
                        ...answers,
                        details: answers.details?.includes(key)
                          ? remaining
                          : [...remaining, key],
                      });
                    }}
                  >
                    {pair[side][locale] || pair[side].en}
                  </button>
                );
              })}
            </div>
          ))}
        </fieldset>
      )}
      <details className="visit-details">
        <summary>{q.details}</summary>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="visit-type">{q.visit}</label>
            <select
              id="visit-type"
              disabled={busy}
              value={answers.visit}
              onChange={(e) =>
                onChange({
                  ...answers,
                  visit: e.target.value as Answers["visit"],
                })
              }
            >
              <option value="">{q.skip}</option>
              <option value="first">{q.first}</option>
              <option value="returning">{q.returning}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="visit-spend">{q.spend}</label>
            <input
              id="visit-spend"
              type="number"
              min="0"
              max="100000"
              step="0.01"
              disabled={busy}
              value={spendText}
              onChange={(e) => {
                setSpendText(e.target.value);
                onChange({
                  ...answers,
                  spend: e.target.value === "" ? null : Number(e.target.value),
                });
              }}
            />
          </div>
        </div>
      </details>
    </section>
  );
}
