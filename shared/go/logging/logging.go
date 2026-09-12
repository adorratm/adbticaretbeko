package logging

import (
	"encoding/json"
	"io"
	"os"
	"time"
)

type Logger struct {
	service string
	out     io.Writer
}

func New(service string) *Logger {
	return &Logger{service: service, out: os.Stdout}
}

type entry map[string]any

func (l *Logger) log(level, event string, fields map[string]any) {
	e := entry{
		"level":     level,
		"service":   l.service,
		"event":     event,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	}
	for k, v := range fields {
		e[k] = v
	}
	_ = json.NewEncoder(l.out).Encode(e)
}

func (l *Logger) Info(event string, fields map[string]any) {
	l.log("info", event, fields)
}

func (l *Logger) Error(event string, fields map[string]any) {
	l.log("error", event, fields)
}

func (l *Logger) Warn(event string, fields map[string]any) {
	l.log("warn", event, fields)
}
