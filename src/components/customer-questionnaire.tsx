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

      <fieldset className="spend-panel" disabled={busy}>
        <legend>
          {q.spendQuestion} <span className="spend-optional">{q.spendOptional}</span>
        </legend>
        <p id="spend-help">{q.spendHint}</p>
        <div className="spend-range-scale" aria-hidden="true">
          <span>RM 0</span>
          <span>RM 5,000</span>
        </div>
        <label className="sr-only" htmlFor="visit-spend-range">
          {q.spendRange}
        </label>
        <input
          id="visit-spend-range"
          className="spend-range"
          type="range"
          min="0"
          max="5000"
          step="10"
          aria-describedby="spend-help"
          value={Math.max(0, Math.min(5000, Math.round((answers.spend ?? 0) / 10) * 10))}
          onChange={(e) => {
            const spend = Number(e.target.value);
            setSpendText(String(spend));
            onChange({ ...answers, spend });
          }}
        />
        <div className="spend-amount-row">
          <div className="spend-amount-field">
            <label htmlFor="visit-spend">{q.spend}</label>
            <div className="spend-input-wrap">
              <span aria-hidden="true">RM</span>
              <input
                id="visit-spend"
                type="number"
                inputMode="decimal"
                min="0"
                max="100000"
                step="0.01"
                placeholder="0.00"
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
          {answers.spend !== null && (
            <button
              className="spend-clear"
              type="button"
              onClick={() => {
                setSpendText("");
                onChange({ ...answers, spend: null });
              }}
            >
              {q.clearSpend}
            </button>
          )}
        </div>
      </fieldset>
    </section>
  );
}
