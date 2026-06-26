import Icon from "../common/Icon";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, addDays, nextMonday } from "date-fns";
import { useRef } from "react";
import { isPastLocalDate } from "../../utils/dateTime";
import { useToast } from "../../context/ToastContext";

export default function DatePickerPopover({
  taskDeadline,
  setTaskDeadline,

  taskTime,
  setTaskTime,

  setIsDatePickerOpen,
}) {
  const timeInputRef = useRef();
  const { showToast } = useToast();

  const selectDeadline = (date, { close = false } = {}) => {
    if (!date) {
      setTaskDeadline(null);
      setTaskTime("");
      if (close) setIsDatePickerOpen(false);
      return;
    }

    if (isPastLocalDate(date)) {
      showToast("Date is in the past, please select a future date.", "error");
      return;
    }

    setTaskDeadline(date);
    if (close) setIsDatePickerOpen(false);
  };

  return (
    <div className="date-picker-popover">
      <div className="date-picker-header">
        <input
          value={taskDeadline ? format(taskDeadline, "d MMM") : ""}
          placeholder="Type a due date"
          readOnly
        />
      </div>
      <div className="date-picker-content">
        <div className="quick-options">
          <button
            onClick={() => {
              selectDeadline(new Date(), { close: true });
            }}
          >
            <span className="left">
              <Icon name="calendar" size={16} color="#db4035" /> Today
            </span>

            <span className="day">{format(new Date(), "E")}</span>
          </button>

          <button
            onClick={() => {
              selectDeadline(addDays(new Date(), 1), { close: true });
            }}
          >
            <span className="left">
              <Icon name="calendar" size={16} color="#ff9933" /> Tomorrow
            </span>

            <span className="day">{format(addDays(new Date(), 1), "E")}</span>
          </button>

          <button
            onClick={() => {
              let target = new Date();

              const diff = 6 - target.getDay();

              selectDeadline(addDays(target, diff >= 0 ? diff : diff + 7), {
                close: true,
              });
            }}
          >
            <span className="left">
              <Icon name="grid" size={16} color="#246fe0" /> This weekend
            </span>

            <span className="day">Sat</span>
          </button>

          <button
            onClick={() => {
              selectDeadline(nextMonday(new Date()), { close: true });
            }}
          >
            <span className="left">
              <Icon name="share" size={16} color="#af38eb" /> Next week
            </span>

            <span className="day">
              {format(nextMonday(new Date()), "E d MMM")}
            </span>
          </button>

          <button
            onClick={() => {
              selectDeadline(null, { close: true });
            }}
          >
            <span className="left">
              <Icon name="help" size={16} color="#808080" /> No Date
            </span>
          </button>
        </div>

        <div className="calendar-section">
          <DatePicker
            selected={taskDeadline}
            onChange={(date) => selectDeadline(date)}
            dayClassName={(date) =>
              isPastLocalDate(date) ? "date-picker-day-past" : undefined
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
          <span className="label">Time:</span>

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
          Save
        </button>
      </div>
    </div>
  );
}
