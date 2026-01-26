# Kubernetes Deployment

Deploy ServalSheets on Kubernetes for production-grade scalability and reliability.

## Prerequisites

- Kubernetes 1.23+
- kubectl configured
- Google service account credentials

## Quick Start

```bash
# Create namespace
kubectl create namespace servalsheets

# Create secrets
kubectl create secret generic google-credentials \
  --namespace servalsheets \
  --from-file=service-account.json=/path/to/service-account.json

kubectl create secret generic oauth-secrets \
  --namespace servalsheets \
  --from-literal=client-id=YOUR_CLIENT_ID \
  --from-literal=client-secret=YOUR_CLIENT_SECRET \
  --from-literal=session-secret=$(openssl rand -hex 32)

# Apply manifests
kubectl apply -f deployment/k8s/
```

## Manifests

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: servalsheets
  namespace: servalsheets
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: servalsheets
  template:
    metadata:
      labels:
        app: servalsheets
      annotations:
        prometheus.io/scrape: 'true'
        prometheus.io/port: '3000'
    spec:
      containers:
        - name: servalsheets
          image: servalsheets:1.6.0
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: 'production'
            - name: GOOGLE_APPLICATION_CREDENTIALS
              value: '/etc/google/service-account.json'
          volumeMounts:
            - name: google-credentials
              mountPath: /etc/google
              readOnly: true
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2Gi
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
      volumes:
        - name: google-credentials
          secret:
            secretName: google-credentials
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: servalsheets
  namespace: servalsheets
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app: servalsheets
```

### Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: servalsheets
  namespace: servalsheets
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - sheets.example.com
      secretName: servalsheets-tls
  rules:
    - host: sheets.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: servalsheets
                port:
                  number: 80
```

### HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: servalsheets
  namespace: servalsheets
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: servalsheets
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## Monitoring

```bash
# Check pods
kubectl get pods -n servalsheets

# View logs
kubectl logs -n servalsheets -l app=servalsheets -f

# Port forward for local testing
kubectl port-forward -n servalsheets svc/servalsheets 3000:80
```

## Troubleshooting

```bash
# Describe pod issues
kubectl describe pod -n servalsheets <pod-name>

# Check events
kubectl get events -n servalsheets --sort-by='.lastTimestamp'

# Exec into pod
kubectl exec -n servalsheets -it <pod-name> -- /bin/sh
```

## Next Steps

- [Helm](./helm) - Package management
- [Monitoring](./monitoring) - Prometheus + Grafana
- [AWS](./aws) - ECS Fargate deployment
