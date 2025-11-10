import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.development';

export interface ServerResponse<T = any> {
  data: T | null;
  success: boolean;
  error: string;
}

export interface Claim {
  id: string;
  claim_number?: string;
  description?: string;
  status: string;
  createdAt?: string;
  documents?: any[];
  images?: any[];
  validationResults?: any;
  policyDetails?: any;
  overallConfidence?: number;
  manualReviewRequired?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ClaimsService {
  private _url = `${environment['APIUrl']}/claims`;

  constructor(private http: HttpClient) {}

  /**
   * Create a new insurance claim
   * POST /api/v1/claims/create
   */
  createClaim(claimNumber?: string, description?: string): Observable<ServerResponse<Claim>> {
    const formData = new FormData();
    // FastAPI Form(None) expects fields to be present, even if empty
    // Send empty string if not provided to match Form(None) behavior
    formData.append('claim_number', claimNumber || '');
    formData.append('description', description || '');
    return this.http.post<ServerResponse<Claim>>(`${this._url}/create`, formData);
  }

  /**
   * Upload a document for claim validation
   * POST /api/v1/claims/{claim_id}/documents
   * 
   * Supported document types: policy, claim_form, driving_license, aadhaar, pan, repair_estimate
   */
  uploadDocument(
    claimId: string,
    documentType: string,
    file: File
  ): Observable<ServerResponse> {
    const formData = new FormData();
    formData.append('document_type', documentType);
    formData.append('file', file);
    return this.http.post<ServerResponse>(`${this._url}/${claimId}/documents`, formData);
  }

  /**
   * Upload a car damage image for claim validation
   * POST /api/v1/claims/{claim_id}/images
   */
  uploadImage(
    claimId: string,
    file: File,
    angleDescription?: string
  ): Observable<ServerResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (angleDescription) {
      formData.append('angle_description', angleDescription);
    }
    return this.http.post<ServerResponse>(`${this._url}/${claimId}/images`, formData);
  }

  /**
   * Perform comprehensive validation on a claim
   * POST /api/v1/claims/{claim_id}/validate
   */
  validateClaim(claimId: string): Observable<ServerResponse> {
    return this.http.post<ServerResponse>(`${this._url}/${claimId}/validate`, {});
  }

  /**
   * Get claim details by ID
   * GET /api/v1/claims/{claim_id}
   */
  getClaim(claimId: string): Observable<ServerResponse<Claim>> {
    return this.http.get<ServerResponse<Claim>>(`${this._url}/${claimId}`);
  }

  /**
   * Get all claims with pagination
   * GET /api/v1/claims/
   */
  getAllClaims(skip: number = 0, limit: number = 10): Observable<ServerResponse<Claim[]>> {
    const params = new HttpParams()
      .set('skip', skip.toString())
      .set('limit', limit.toString());
    return this.http.get<ServerResponse<Claim[]>>(`${this._url}/`, { params });
  }
}

