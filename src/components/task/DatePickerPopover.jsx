import Icon from "../common/Icon";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, addDays, nextMonday } from "date-fns";
import { useRef } from "react";

export default function DatePickerPopover({
  taskDeadline,
  setTaskDeadline,

  taskTime,
  setTaskTime,

  setIsDatePickerOpen,
}) {
  const timeInputRef = useRef();
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
              setTaskDeadline(new Date());
              setIsDatePickerOpen(false);
            }}
          >
            <span className="left">
              <Icon name="calendar" size={16} color="#db4035" /> Today
            </span>

            <span className="day">{format(new Date(), "E")}</span>
          </button>

          <button
            onClick={() => {
              setTaskDeadline(addDays(new Date(), 1));

              setIsDatePickerOpen(false);
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

              setTaskDeadline(addDays(target, diff >= 0 ? diff : diff + 7));

              setIsDatePickerOpen(false);
            }}
          >
            <span className="left">
              <Icon name="grid" size={16} color="#246fe0" /> This weekend
            </span>

            <span className="day">Sat</span>
          </button>

          <button
            onClick={() => {
              setTaskDeadline(nextMonday(new Date()));

              setIsDatePickerOpen(false);
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
              setTaskDeadline(null);
              setTaskTime("");

              setIsDatePickerOpen(false);
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
            onChange={(date) => setTaskDeadline(date)}
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
          onClick={() => setIsDatePickerOpen(false)}
          style={{ background: "#2c6fd2", color: "#fff", padding: "12px 20px" }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
