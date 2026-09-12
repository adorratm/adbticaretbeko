package media

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/url"
	"path"
	"strings"

	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type Client struct {
	mc         *minio.Client
	bucket     string
	publicBase string
	enabled    bool
}

func NewFromEnv() (*Client, error) {
	endpoint := config.Getenv("S3_ENDPOINT", "http://localhost:9000")
	access := config.Getenv("S3_ACCESS_KEY", "minioadmin")
	secret := config.Getenv("S3_SECRET_KEY", "minioadmin")
	bucket := config.Getenv("S3_BUCKET", "adb-products")
	useSSL := config.Getenv("S3_USE_SSL", "false") == "true"
	public := config.Getenv("S3_PUBLIC_URL", endpoint+"/"+bucket)

	u, err := url.Parse(endpoint)
	if err != nil {
		return &Client{enabled: false}, nil
	}
	host := u.Host
	if host == "" {
		host = strings.TrimPrefix(endpoint, "http://")
		host = strings.TrimPrefix(host, "https://")
	}
	mc, err := minio.New(host, &minio.Options{
		Creds:  credentials.NewStaticV4(access, secret, ""),
		Secure: useSSL,
	})
	if err != nil {
		return &Client{enabled: false}, nil
	}
	c := &Client{mc: mc, bucket: bucket, publicBase: strings.TrimRight(public, "/"), enabled: true}
	ctx := context.Background()
	exists, err := mc.BucketExists(ctx, bucket)
	if err == nil && !exists {
		_ = mc.MakeBucket(ctx, bucket, minio.MakeBucketOptions{})
	}
	return c, nil
}

func (c *Client) Enabled() bool { return c != nil && c.enabled && c.mc != nil }

func (c *Client) Upload(ctx context.Context, productID, filename string, r io.Reader, size int64, contentType string) (string, error) {
	if !c.Enabled() {
		return "", fmt.Errorf("S3/MinIO yapılandırılmadı")
	}
	ext := path.Ext(filename)
	if ext == "" {
		ext = ".bin"
	}
	key := fmt.Sprintf("products/%s/%s%s", productID, uuid.NewString(), ext)
	_, err := c.mc.PutObject(ctx, c.bucket, key, r, size, minio.PutObjectOptions{ContentType: contentType})
	if err != nil {
		return "", err
	}
	return c.publicBase + "/" + key, nil
}

func (c *Client) UploadBytes(ctx context.Context, productID, filename string, data []byte, contentType string) (string, error) {
	return c.Upload(ctx, productID, filename, bytes.NewReader(data), int64(len(data)), contentType)
}
