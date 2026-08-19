import Icon from "../common/Icon";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, addDays, nextMonday } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { useRef } from "react";
import { isPastLocalDate, parseLocalDate } from "../../utils/dateTime";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { getTranslation } from "../../i18n/translations";

registerLocale("en", enUS);
registerLocale("vi", vi);

export default function DatePickerPopover({
  taskDeadline,
  setTaskDeadline,

  taskTime,
  setTaskTime,

  setIsDatePickerOpen,
  minDate,
  maxDate,
}) {
  const timeInputRef = useRef();
  const { showToast } = useToast();
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  const dateLocale = language === "vi" ? vi : enUS;
  const normalizedMinDate = parseLocalDate(minDate) || new Date();
  const normalizedMaxDate = parseLocalDate(maxDate);
  const normalizedDeadline = parseLocalDate(taskDeadline);
  const todayDate = parseLocalDate(new Date());
  const tomorrowDate = addDays(todayDate, 1);
  const weekendDate = addDays(todayDate, (6 - todayDate.getDay() + 7) % 7);
  const nextWeekDate = nextMonday(todayDate);

  const isDateAllowed = (date) => {
    const selectedDate = parseLocalDate(date);
    if (!selectedDate || isPastLocalDate(selectedDate)) return false;
    if (normalizedMinDate && selectedDate < parseLocalDate(normalizedMinDate)) return false;
    if (normalizedMaxDate && selectedDate > normalizedMaxDate) return false;
    return true;
  };

  const disabledQuickDateTitle = language === "vi"
    ? "Ngày này nằm ngoài thời gian của stage/project"
    : "This date is outside the stage/project date range";

  const selectDeadline = (date, { close = false } = {}) => {
    if (!date) {
      setTaskDeadline(null);
      setTaskTime("");
      if (close) setIsDatePickerOpen(false);
      return;
    }

    if (isPastLocalDate(date)) {
      showToast(language === "vi" ? "Ngày đã qua, vui lòng chọn ngày khác." : "Date is in the past, please select a future date.", "error");
      return;
    }
    const selectedDate = parseLocalDate(date);
    if (selectedDate && normalizedMinDate && selectedDate < parseLocalDate(normalizedMinDate)) {
      showToast(language === "vi" ? "Hạn chót của task không được trước ngày bắt đầu stage." : "The task deadline cannot be before the stage start date.", "error");
      return;
    }
    if (selectedDate && normalizedMaxDate && selectedDate > normalizedMaxDate) {
      showToast(language === "vi" ? "Hạn chót của task không được vượt quá hạn stage/project." : "The task deadline cannot exceed the stage/project deadline.", "error");
      return;
    }

    setTaskDeadline(date);
    if (close) setIsDatePickerOpen(false);
  };

  return (
    <div className="date-picker-popover">
      <div className="date-picker-header">
        <input
          type="date"
          value={normalizedDeadline ? format(normalizedDeadline, "yyyy-MM-dd") : ""}
          min={normalizedMinDate ? format(normalizedMinDate, "yyyy-MM-dd") : undefined}
          max={normalizedMaxDate ? format(normalizedMaxDate, "yyyy-MM-dd") : undefined}
          aria-label={t("typeDueDate")}
          onChange={(event) => selectDeadline(parseLocalDate(event.target.value))}
        />
      </div>
      <div className="date-picker-content">
        <div className="quick-options">
          <button
            type="button"
            disabled={!isDateAllowed(todayDate)}
            title={!isDateAllowed(todayDate) ? disabledQuickDateTitle : undefined}
            onClick={() => {
              selectDeadline(todayDate, { close: true });
            }}
          >
            <span className="left">
              <Icon name="calendar" size={16} color="#db4035" /> {t("today")}
            </span>

            <span className="day">{format(todayDate, "E", { locale: dateLocale })}</span>
          </button>

          <button
            type="button"
            disabled={!isDateAllowed(tomorrowDate)}
            title={!isDateAllowed(tomorrowDate) ? disabledQuickDateTitle : undefined}
            onClick={() => {
              selectDeadline(tomorrowDate, { close: true });
            }}
          >
            <span className="left">
              <Icon name="calendar" size={16} color="#ff9933" /> {t("tomorrow")}
            </span>

            <span className="day">{format(tomorrowDate, "E", { locale: dateLocale })}</span>
          </button>

          <button
            type="button"
            disabled={!isDateAllowed(weekendDate)}
            title={!isDateAllowed(weekendDate) ? disabledQuickDateTitle : undefined}
            onClick={() => {
              selectDeadline(weekendDate, { close: true });
            }}
          >
            <span className="left">
              <Icon name="grid" size={16} color="#246fe0" /> {t("thisWeekend")}
            </span>

            <span className="day">{format(weekendDate, "E", { locale: dateLocale })}</span>
          </button>

          <button
            type="button"
            disabled={!isDateAllowed(nextWeekDate)}
            title={!isDateAllowed(nextWeekDate) ? disabledQuickDateTitle : undefined}
            onClick={() => {
              selectDeadline(nextWeekDate, { close: true });
            }}
          >
            <span className="left">
              <Icon name="share" size={16} color="#af38eb" /> {t("nextWeek")}
            </span>

            <span className="day">
              {format(nextWeekDate, "E d MMM", { locale: dateLocale })}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              selectDeadline(null, { close: true });
            }}
          >
            <span className="left">
              <Icon name="help" size={16} color="#808080" /> {t("noDate")}
            </span>
          </button>
        </div>

        <div className="calendar-section">
          <DatePicker
            selected={normalizedDeadline}
            onChange={(date) => selectDeadline(date)}
            minDate={normalizedMinDate}
            maxDate={normalizedMaxDate || undefined}
            locale={language}
            dayClassName={(date) =>
              isPastLocalDate(date) ||
              (normalizedMinDate && parseLocalDate(date) < parseLocalDate(normalizedMinDate)) ||
              (normalizedMaxDate && parseLocalDate(date) > normalizedMaxDate)
                ? "date-picker-day-past"
                : undefined
            }
            inline
          />
        </div>
      </div>

      <div
        className="time-section"
        onClick={() => {
          timeInputRef.current?.showPicker?.();
          timeInputRef.current?.focus();
        }}
      >
        <div className="time-input">
          <span className="label">{t("time")}:</span>

          <input
            ref={timeInputRef}
            type="time"
            value={taskTime}
            onChange={(e) => setTaskTime(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      <div className="date-picker-footer">
        <button
          type="button"
          className="submit-btn"
          onClick={() => {
            if (isPastLocalDate(taskDeadline)) {
              showToast("Ngày đã qua, vui lòng chọn hôm nay hoặc ngày sau.", "error");
              return;
            }
            setIsDatePickerOpen(false);
          }}
          style={{ background: "#2c6fd2", color: "#fff", padding: "12px 20px" }}
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}
